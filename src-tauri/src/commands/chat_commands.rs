use tauri::{AppHandle, Emitter, Manager, State};

use crate::services::ai_tools::ToolFilter;
use crate::services::chat_execution_service::{
    ChatExecutionService, ChatMessageEvent, ChatPhaseEvent,
};
use crate::services::chat_service::{
    ChatMessageRecord, ChatSession, CreateChatSessionRequest, UpdateChatSessionRequest,
};
use crate::state::AppState;

// ─── 会话管理 ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_chat_sessions(state: State<'_, AppState>) -> Result<Vec<ChatSession>, String> {
    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let result = chat_svc.list_sessions().await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_chat_session(
    state: State<'_, AppState>,
    payload: CreateChatSessionRequest,
) -> Result<ChatSession, String> {
    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let result = chat_svc.create_session(payload).await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_chat_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    payload: UpdateChatSessionRequest,
) -> Result<ChatSession, String> {
    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let result = chat_svc.update_session(&session_id, payload).await;
    let session = result.map_err(|e| e.to_string())?;
    crate::services::chat_service::emit_chat_session_updated(&app, &session);
    Ok(session)
}

#[tauri::command]
pub async fn delete_chat_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let result = chat_svc.delete_session(&session_id).await;
    result.map_err(|e| e.to_string())
}

// ─── 消息管理 ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_chat_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<ChatMessageRecord>, String> {
    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let result = chat_svc.list_messages(&session_id).await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    text: String,
    image_base64: Option<String>,
) -> Result<(), String> {
    // 获取会话配置
    let (profile_id, ai_config_id, system_prompt, tool_categories, profile_ids, active_profile_id, enabled_skill_slugs) = {
        let chat_svc = state
            .chat_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        let session = chat_svc
            .get_session(&session_id)
            .await
            .map_err(|e| e.to_string())?;
        (
            session.profile_id,
            session.ai_config_id,
            session.system_prompt,
            session.tool_categories,
            session.profile_ids,
            session.active_profile_id,
            session.enabled_skill_slugs,
        )
    };

    // 加载 AI 配置
    let ai_config = {
        let pref_svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        if let Some(ref cid) = ai_config_id {
            pref_svc
                .find_ai_config_by_id(cid)
                .map_err(|e| e.to_string())?
                .map(|e| {
                    crate::services::chat_execution_service::ai_config_entry_to_provider_config(&e)
                })
                .unwrap_or_default()
        } else {
            // 使用第一个可用配置
            pref_svc
                .list_ai_configs()
                .map_err(|e| e.to_string())?
                .into_iter()
                .next()
                .map(|e| {
                    crate::services::chat_execution_service::ai_config_entry_to_provider_config(&e)
                })
                .unwrap_or_default()
        }
    };

    // 全局提示词
    let global_prompt = {
        let pref_svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        pref_svc.read_ai_chat_global_prompt().ok().flatten()
    };

    // 构建工具过滤器
    let tool_filter = match tool_categories {
        Some(cats) if !cats.is_empty() => ToolFilter::with_categories(cats),
        _ => ToolFilter::all(),
    };
    // 无 profile 时排除需要浏览器的工具类别
    let has_profile =
        profile_id.is_some() || profile_ids.as_ref().map_or(false, |ids| !ids.is_empty());
    let tool_filter = if !has_profile {
        tool_filter.exclude(vec!["cdp".to_string(), "magic".to_string()])
    } else {
        tool_filter
    };
    let tool_target_profile_id = crate::services::chat_service::resolve_chat_tool_target_profile_id(
        profile_id.as_deref(),
        profile_ids.as_deref(),
        active_profile_id.as_deref(),
    );

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let app_state = app_handle.state::<AppState>();
        let result = ChatExecutionService::send_message(
            &app_handle,
            &session_id,
            &text,
            image_base64.as_deref(),
            tool_target_profile_id.as_deref(),
            &ai_config,
            system_prompt.as_deref(),
            global_prompt.as_deref(),
            &tool_filter,
            &app_state.chat_cancel_tokens,
            profile_ids.as_deref(),
            active_profile_id.as_deref(),
            &enabled_skill_slugs,
        )
        .await;

        if let Err(err) = result {
            crate::logger::error(
                "ai-chat",
                format!(
                    "Background chat generation failed: {} (session={})",
                    err, session_id
                ),
            );
            emit_background_chat_failure(&app_handle, &session_id, &err).await;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_chat_generation(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let mut tokens = state
        .chat_cancel_tokens
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    tokens.insert(session_id, true);
    Ok(())
}

#[tauri::command]
pub async fn regenerate_chat_message(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    // 找到最后一条用户消息的 sort_order，删除之后的消息，重新发送
    let (last_user_text, sort_order) = {
        let chat_svc = state
            .chat_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        let messages = chat_svc
            .list_messages(&session_id)
            .await
            .map_err(|e| e.to_string())?;
        let last_user = messages
            .iter()
            .filter(|m| m.role == "user")
            .last()
            .ok_or_else(|| "no user message found".to_string())?
            .clone();
        (
            last_user.content_text.unwrap_or_default(),
            last_user.sort_order,
        )
    };

    // 删除最后一条用户消息之后（含）的所有消息
    {
        let chat_svc = state
            .chat_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        chat_svc
            .delete_messages_from(&session_id, sort_order)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 重新发送
    Box::pin(send_chat_message(
        app,
        state,
        session_id,
        last_user_text,
        None,
    ))
    .await
}

// ─── 全局提示词 ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_ai_chat_global_prompt(state: State<'_, AppState>) -> Result<Option<String>, String> {
    state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .read_ai_chat_global_prompt()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_ai_chat_global_prompt(
    state: State<'_, AppState>,
    prompt: Option<String>,
) -> Result<(), String> {
    state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .save_ai_chat_global_prompt(prompt)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_global_default_startup_url(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .read_global_default_startup_url()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_global_default_startup_url(
    state: State<'_, AppState>,
    url: Option<String>,
) -> Result<(), String> {
    state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .save_global_default_startup_url(url)
        .map_err(|e| e.to_string())
}

// ─── 环境上下文 ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_profile_environment_context(
    state: State<'_, AppState>,
    profile_ids: Vec<String>,
    active_profile_id: Option<String>,
) -> Result<Vec<crate::services::profile_context_service::ProfileEnvironmentContext>, String> {
    let ps = state
        .profile_service
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    let px = state
        .proxy_service
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    crate::services::profile_context_service::get_profile_environment_contexts(
        &profile_ids,
        active_profile_id.as_deref(),
        &ps,
        &px,
    )
    .map_err(|e| e.to_string())
}

// ─── AI 连接测试 ──────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_ai_connection(
    config_id: String,
    state: State<'_, AppState>,
) -> Result<ConnectionTestResult, String> {
    let config_entry = {
        let pref = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        let all_configs = pref.list_ai_configs().map_err(|e| e.to_string())?;
        all_configs
            .into_iter()
            .find(|c| c.id == config_id)
            .ok_or_else(|| "AI config not found".to_string())?
    };
    let provider_config =
        crate::services::chat_execution_service::ai_config_entry_to_provider_config(&config_entry);
    let ai = crate::services::ai_service::AiService::with_timeout(10);

    let start = std::time::Instant::now();
    let test_messages = vec![crate::services::ai_service::ChatMessage::user("Say 'ok'")];

    match ai.chat(&provider_config, test_messages, None).await {
        Ok(_) => Ok(ConnectionTestResult {
            success: true,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            error: None,
        }),
        Err(e) => Ok(ConnectionTestResult {
            success: false,
            latency_ms: None,
            error: Some(e),
        }),
    }
}

// ─── 工具权限管理 ─────────────────────────────────────────────────────────

/// 工具权限条目（前端展示用）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolPermissionEntry {
    pub tool_name: String,
    pub display_name: String,
    pub description: String,
    pub risk_level: String,
    pub require_confirmation: bool,
}

/// 获取工具的显示名称和描述
fn get_tool_metadata(name: &str) -> (String, String) {
    match name {
        // 应用级别操作
        "app_delete_profile" => (
            "删除环境".to_string(),
            "永久删除指定的浏览器环境配置".to_string(),
        ),
        "app_delete_proxy" => ("删除代理".to_string(), "永久删除指定的代理配置".to_string()),
        "app_delete_group" => ("删除分组".to_string(), "永久删除指定的环境分组".to_string()),
        "app_stop_profile" => (
            "停止环境".to_string(),
            "强制停止正在运行的浏览器环境".to_string(),
        ),
        "app_update_device_preset" => (
            "修改机型预设".to_string(),
            "修改指定的机型预设参数，可能影响后续环境创建与指纹解析".to_string(),
        ),
        "app_delete_device_preset" => (
            "删除机型预设".to_string(),
            "永久删除指定的机型预设，引用它的环境将失去对应机型配置".to_string(),
        ),
        "app_stop_all_profiles" => (
            "停止全部环境".to_string(),
            "强制停止所有正在运行的浏览器环境".to_string(),
        ),
        "app_purge_profile" => (
            "清空环境回收站".to_string(),
            "彻底删除回收站中的环境，无法恢复".to_string(),
        ),
        "app_purge_proxy" => (
            "清空代理回收站".to_string(),
            "彻底删除回收站中的代理配置".to_string(),
        ),
        "app_purge_group" => (
            "清空分组回收站".to_string(),
            "彻底删除回收站中的分组配置".to_string(),
        ),

        // Magic 控制操作
        "magic_set_closed" => (
            "关闭 Magic".to_string(),
            "关闭 Magic 控制通道，停止浏览器扩展通信".to_string(),
        ),
        "magic_safe_quit" => (
            "安全退出 Magic".to_string(),
            "优雅关闭 Magic 控制器，保存当前状态".to_string(),
        ),

        // 文件系统操作
        "file_write" => ("写入文件".to_string(), "创建或覆盖文件内容".to_string()),
        "file_delete" => ("删除文件".to_string(), "永久删除指定文件".to_string()),
        "file_append" => ("追加文件内容".to_string(), "向文件末尾追加内容".to_string()),

        // 浏览器数据清除
        "cdp_clear_cookies" => (
            "清除 Cookies".to_string(),
            "清除浏览器的所有 Cookie 数据".to_string(),
        ),
        "cdp_clear_local_storage" => (
            "清除 Local Storage".to_string(),
            "清除浏览器的本地存储数据".to_string(),
        ),
        "cdp_clear_session_storage" => (
            "清除 Session Storage".to_string(),
            "清除浏览器的会话存储数据".to_string(),
        ),

        // 自动化脚本操作
        "auto_delete_script" => (
            "删除脚本".to_string(),
            "永久删除指定的自动化脚本".to_string(),
        ),

        // 默认回退
        _ => (name.to_string(), "".to_string()),
    }
}

/// 获取所有危险工具的权限设置
#[tauri::command]
pub fn get_tool_permissions(
    state: State<'_, AppState>,
) -> Result<Vec<ToolPermissionEntry>, String> {
    let pref_svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    let overrides = pref_svc.get_tool_confirmation_overrides();

    let entries = crate::services::ai_tools::all_dangerous_tool_names()
        .into_iter()
        .map(|name| {
            let require = overrides.get(name).copied().unwrap_or(true);
            let (display_name, description) = get_tool_metadata(name);
            ToolPermissionEntry {
                tool_name: name.to_string(),
                display_name,
                description,
                risk_level: "dangerous".to_string(),
                require_confirmation: require,
            }
        })
        .collect();

    Ok(entries)
}

/// 设置单个工具的确认开关
#[tauri::command]
pub fn set_tool_permission(
    state: State<'_, AppState>,
    tool_name: String,
    require_confirmation: bool,
) -> Result<(), String> {
    let pref_svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    pref_svc
        .set_tool_confirmation_override(&tool_name, require_confirmation)
        .map_err(|e| e.to_string())
}

/// 批量设置所有危险工具的确认开关
#[tauri::command]
pub fn set_all_tool_permissions(
    state: State<'_, AppState>,
    require_confirmation: bool,
) -> Result<(), String> {
    let pref_svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    pref_svc
        .set_all_tool_confirmation_overrides(require_confirmation)
        .map_err(|e| e.to_string())
}

/// 前端提交工具确认响应
#[tauri::command]
pub fn submit_tool_confirmation(
    state: State<'_, AppState>,
    request_id: String,
    confirmed: bool,
) -> Result<(), String> {
    let mut channels = state
        .tool_confirmation_channels
        .lock()
        .map_err(|_| "tool_confirmation_channels lock poisoned".to_string())?;
    if let Some(sender) = channels.remove(&request_id) {
        let _ = sender.send(confirmed);
        Ok(())
    } else {
        Err(format!(
            "No pending confirmation for request_id: {}",
            request_id
        ))
    }
}

async fn emit_background_chat_failure(app: &AppHandle, session_id: &str, err: &str) {
    let chat_service = app
        .state::<AppState>()
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();

    if let Ok(message) = chat_service
        .add_message(
            session_id,
            "system",
            Some(format!("⚠ 聊天执行失败：{err}")),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
    {
        let _ = app.emit(
            "ai_chat://message",
            ChatMessageEvent {
                session_id: session_id.to_string(),
                message,
            },
        );
    }

    let _ = app.emit(
        "ai_chat://phase",
        ChatPhaseEvent {
            session_id: session_id.to_string(),
            phase: "error".to_string(),
            round: 0,
            max_rounds: 0,
            tool_name: None,
            error: Some(err.to_string()),
            elapsed_ms: 0,
            prompt_tokens: None,
            completion_tokens: None,
            context_used: None,
            context_limit: None,
        },
    );
}
