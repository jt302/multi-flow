//! AI 聊天执行引擎
//!
//! 复用现有 AiService + ToolRegistry 基础设施，为交互式聊天提供 AI tool calling 循环。
//! 与 AiAgent ScriptStep 的主要区别：
//! - 消息历史从 DB 加载，跨会话持久化
//! - 以自然语言文本回复为结束条件（无 submit_result）
//! - 每条消息/工具调用结果实时保存到 DB
//! - 通过 Tauri events 推送实时进度

use std::collections::{HashMap, VecDeque};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::logger;
use crate::models::RunLogEntry;
use crate::services::ai_service::{AiService, ChatMessage};
use crate::services::ai_tools::{ToolContext, ToolFilter, ToolRegistry};
use crate::services::app_preference_service::{AiConfigEntry, AiProviderConfig};
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;

// ─── Tauri 事件类型 ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageEvent {
    pub session_id: String,
    pub message: crate::services::chat_service::ChatMessageRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatPhaseEvent {
    pub session_id: String,
    pub phase: String, // "thinking" | "tool_calling" | "done" | "error"
    pub round: u32,
    pub max_rounds: u32,
    pub tool_name: Option<String>,
    pub error: Option<String>,
    pub elapsed_ms: u64,
    pub prompt_tokens: Option<i32>,
    pub completion_tokens: Option<i32>,
    pub context_used: Option<u64>,
    pub context_limit: Option<u64>,
}

/// 流式消息增量事件
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageDeltaEvent {
    pub session_id: String,
    pub message_id: String,
    pub kind: String, // "text" | "tool_start"
    pub delta: Option<String>,
    pub tool_call_index: Option<u32>,
    pub tool_name: Option<String>,
}

// ─── ChatExecutionService ─────────────────────────────────────────────────

pub struct ChatExecutionService;

impl ChatExecutionService {
    /// 发送用户消息并执行 AI tool calling 循环
    ///
    /// 执行流程：
    /// 1. 保存用户消息到 DB
    /// 2. 从 DB 构建消息历史
    /// 3. 构建系统提示词
    /// 4. 进入 tool calling 循环：
    ///    a. 调用 AiService::chat_with_tools
    ///    b. 若返回 ToolCalls：保存 assistant + tool results 到 DB，继续循环
    ///    c. 若返回 Text：保存 assistant 文本到 DB，结束
    /// 5. 通过 Tauri events 实时推送进度
    pub async fn send_message(
        app: &AppHandle,
        session_id: &str,
        user_text: &str,
        image_base64: Option<&str>,
        profile_id: Option<&str>,
        ai_config: &AiProviderConfig,
        system_prompt: Option<&str>,
        global_prompt: Option<&str>,
        tool_filter: &ToolFilter,
        cancel_tokens: &std::sync::Mutex<HashMap<String, bool>>,
        profile_ids: Option<&[String]>,
        active_profile_id: Option<&str>,
        disabled_mcp_server_ids: &[String],
    ) -> Result<(), String> {
        let chat_service = app
            .state::<crate::state::AppState>()
            .chat_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();

        // 1. 保存用户消息
        let user_msg = chat_service
            .add_message(
                session_id,
                "user",
                Some(user_text.to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                image_base64.map(|s| s.to_string()),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        emit_message(app, session_id, &user_msg);

        // touch session updated_at
        let _ = chat_service.touch_session(session_id).await;

        // 2. 从 DB 构建 AI 消息历史
        let mut messages = chat_service
            .build_ai_messages(session_id)
            .await
            .map_err(|e| e.to_string())?;

        // 3. 构建系统提示词并插入 messages[0]
        let tool_categories: Vec<String> = if tool_filter.categories.is_empty() {
            vec![]
        } else {
            tool_filter.categories.clone()
        };
        let locale = ai_config.locale.as_deref().unwrap_or("zh");

        // 构建 Profile 环境上下文（L2 层）
        let env_text = if let Some(pids) = profile_ids {
            if !pids.is_empty() {
                let state = app.state::<crate::state::AppState>();
                let ps = state
                    .profile_service
                    .lock()
                    .unwrap_or_else(|p| p.into_inner());
                let px = state
                    .proxy_service
                    .lock()
                    .unwrap_or_else(|p| p.into_inner());
                let contexts = crate::services::profile_context_service::extract_contexts(
                    pids,
                    active_profile_id,
                    &ps,
                    &px,
                );
                if contexts.is_empty() {
                    None
                } else {
                    Some(crate::services::profile_context_service::format_for_prompt(
                        &contexts, locale,
                    ))
                }
            } else {
                None
            }
        } else {
            None
        };

        let mut system_prompt_text = crate::services::ai_prompts::build_chat_system_prompt(
            global_prompt,
            system_prompt,
            &tool_categories,
            locale,
            env_text.as_deref(),
            None, // conversation_summary: Phase C
        );
        let enabled_skill_slugs = crate::services::ai_skill_service::from_app(app)
            .ok()
            .and_then(|svc| svc.list_enabled_skill_slugs().ok())
            .unwrap_or_default();
        // Progressive disclosure: 注入 skill 目录（name+description），不注入 body
        let skill_allowed_tools = if !enabled_skill_slugs.is_empty() {
            if let Ok(skill_svc) = crate::services::ai_skill_service::from_app(app) {
                let directory = skill_svc.load_skill_directory(&enabled_skill_slugs);
                if !directory.is_empty() {
                    system_prompt_text.push_str(
                        "\n\n<skills>\nThe following skills are available. Use the `load_skill` tool to load a skill's full instructions when needed.\n",
                    );
                    for (slug, name, desc) in &directory {
                        let desc_str = desc.as_deref().unwrap_or("No description");
                        system_prompt_text
                            .push_str(&format!("- **{name}** (`{slug}`): {desc_str}\n"));
                    }
                    system_prompt_text.push_str("</skills>");
                }
                skill_svc.get_allowed_tools_union(&enabled_skill_slugs)
            } else {
                vec![]
            }
        } else {
            vec![]
        };
        // 4. 获取工具定义（含 MCP 工具）
        // 基于 skill allowed_tools 构建有效过滤器
        let mut effective_filter_owned;
        let effective_filter: &ToolFilter = if !skill_allowed_tools.is_empty() {
            effective_filter_owned = tool_filter.clone();
            effective_filter_owned.allowed_names = skill_allowed_tools;
            &effective_filter_owned
        } else {
            tool_filter
        };
        let mut tools = ToolRegistry::definitions(effective_filter);
        // 动态注入 load_skill 工具（仅在有激活 skill 时）
        if !enabled_skill_slugs.is_empty() {
            tools.push(serde_json::json!({
                "type": "function",
                "function": {
                    "name": "load_skill",
                    "description": "加载指定 skill 的完整指令内容。在 system prompt <skills> 列表中选择目标 skill，调用此工具按需获取详细指令",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "slug": { "type": "string", "description": "Skill 的唯一标识符（slug）" }
                        },
                        "required": ["slug"]
                    }
                }
            }));
        }
        // 注入 MCP Resources 目录到 system prompt
        {
            let mcp_manager = app.state::<crate::state::AppState>().mcp_manager.clone();
            let resources = mcp_manager.all_enabled_resources().await;
            let filtered_resources: Vec<_> = if disabled_mcp_server_ids.is_empty() {
                resources
            } else {
                resources
                    .into_iter()
                    .filter(|r| !disabled_mcp_server_ids.contains(&r.server_id))
                    .collect()
            };
            if !filtered_resources.is_empty() {
                system_prompt_text.push_str("\n\n<mcp_resources>\nThe following MCP resources are available. Use the `read_mcp_resource` tool to read their content.\n");
                for r in &filtered_resources {
                    let desc = r.description.as_deref().unwrap_or("");
                    system_prompt_text.push_str(&format!(
                        "- **{}** (`{}`, server: `{}`){}\n",
                        r.name,
                        r.uri,
                        r.server_id,
                        if desc.is_empty() {
                            String::new()
                        } else {
                            format!(": {desc}")
                        }
                    ));
                }
                system_prompt_text.push_str("</mcp_resources>");
                // 动态注入 read_mcp_resource 工具
                tools.push(serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": "read_mcp_resource",
                        "description": "读取 MCP 服务器资源的内容。在 system prompt <mcp_resources> 列表中找到目标资源 uri 和 server_id，调用此工具获取内容",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "server_id": { "type": "string", "description": "MCP 服务器 ID" },
                                "uri": { "type": "string", "description": "资源 URI" }
                            },
                            "required": ["server_id", "uri"]
                        }
                    }
                }));
            }
        }

        // system prompt 已收集完毕（skills + mcp_resources 均已 push_str）→ 插入 messages[0]
        messages.insert(0, ChatMessage::system(&system_prompt_text));

        // 合并已启用的 MCP 工具（过滤 session 级别禁用的 server）
        {
            let mcp_manager = app.state::<crate::state::AppState>().mcp_manager.clone();
            let all_mcp_tools = mcp_manager.all_enabled_tools().await;
            let mcp_tools: Vec<_> = if disabled_mcp_server_ids.is_empty() {
                all_mcp_tools
            } else {
                all_mcp_tools
                    .into_iter()
                    .filter(|t| !disabled_mcp_server_ids.contains(&t.server_id))
                    .collect()
            };
            if !mcp_tools.is_empty() {
                let mcp_schemas =
                    crate::services::mcp::McpManager::tools_to_openai_schema(&mcp_tools);
                tools.extend(mcp_schemas);
            }
        }
        let ai = AiService::with_timeout(120);
        let mut tool_target_profile_id = profile_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        // 5. 尝试连接当前工具目标环境的运行态
        let (mut cdp_client, mut magic_port) = Self::connect_browser_runtime(
            app,
            session_id,
            tool_target_profile_id.as_deref(),
            ai_config,
            &chat_service,
        )
        .await;
        let http_client = reqwest::Client::new();
        let empty_vars = RunVariables::new();
        let mut logs: Vec<RunLogEntry> = Vec::new();

        // 6. Tool calling 循环（最多 100 轮兜底，用户可随时取消）
        const MAX_ROUNDS: u32 = 100;
        let generation_start = std::time::Instant::now();
        let mut cumulative_prompt_tokens: i32 = 0;
        let mut cumulative_completion_tokens: i32 = 0;
        let mut last_ctx_used: u64 = 0;
        let mut last_ctx_limit: u64 = 0;
        let mut cancelled = false;
        let mut completed = false;
        let mut next_tool_step_index: usize = 0;
        let mut round: u32 = 0;
        // 重复操作检测：记录最近 10 次 (tool_name, args_json)
        let mut recent_tool_calls: VecDeque<(String, String)> = VecDeque::with_capacity(10);
        // 失败升级计数器
        let mut consecutive_tool_failures: HashMap<String, u32> = HashMap::new();
        let mut error_signature_repeats: HashMap<String, u32> = HashMap::new();
        // 连续工具调用但未产出 assistant 文本的轮次计数
        let mut rounds_since_last_text: u32 = 0;
        let mut assistant_text_nudge_injected = false;
        let mut image_input_downgrade_retry_attempted = false;
        loop {
            round += 1;
            let mut escalation_injected = false;

            // 检查取消（循环开始时）
            {
                let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                if tokens.get(session_id).copied().unwrap_or(false) {
                    cancelled = true;
                    break;
                }
            }

            // 硬上限：超过 MAX_ROUNDS 轮时强制停止
            if round > MAX_ROUNDS {
                let stop_text = format!(
                    "⚠ 已达到最大轮次（{}），自动停止。当前任务可能未完成，请检查页面后决定是否继续。",
                    MAX_ROUNDS
                );
                let maxrounds_msg_id = uuid::Uuid::new_v4().to_string();
                let msg = chat_service
                    .add_message_with_id(
                        &maxrounds_msg_id,
                        session_id,
                        "assistant",
                        Some(stop_text.clone()),
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
                    .map_err(|e| e.to_string())?;
                let refreshed_msg = chat_service.get_message(&msg.id).await.unwrap_or(msg);
                emit_message(app, session_id, &refreshed_msg);
                emit_phase(
                    app,
                    session_id,
                    "max_rounds_reached",
                    round,
                    None,
                    None,
                    generation_start.elapsed().as_millis() as u64,
                    Some(cumulative_prompt_tokens),
                    Some(cumulative_completion_tokens),
                    Some(last_ctx_used),
                    Some(last_ctx_limit),
                    MAX_ROUNDS,
                );
                completed = true;
                break;
            }

            emit_phase(
                app,
                session_id,
                "thinking",
                round,
                None,
                None,
                generation_start.elapsed().as_millis() as u64,
                Some(cumulative_prompt_tokens),
                Some(cumulative_completion_tokens),
                Some(last_ctx_used),
                Some(last_ctx_limit),
                MAX_ROUNDS,
            );

            // 保留最近 3 张工具截图，方便 AI 对比前后变化，避免死循环；其余降级为纯文本。
            prepare_messages_for_chat_model(
                &mut messages,
                ai_config.provider.as_deref().unwrap_or(""),
                ai_config.model.as_deref().unwrap_or(""),
            );

            // 滑动窗口压缩：估算 token 数，若超过上下文 75% 则压缩历史
            let ctx_limit = crate::services::token_counter::TokenCounter::context_limit(
                ai_config.provider.as_deref().unwrap_or(""),
                ai_config.model.as_deref().unwrap_or(""),
            );
            let tool_tokens = crate::services::token_counter::TokenCounter::count_tools(&tools);
            let msg_tokens =
                crate::services::token_counter::TokenCounter::count_messages(&messages);
            let total = tool_tokens + msg_tokens;
            let threshold = ctx_limit * 3 / 4;
            last_ctx_used = total as u64;
            last_ctx_limit = ctx_limit as u64;

            if total > threshold && messages.len() > 3 {
                // 保留 system prompt (messages[0]) 和最近 4 条消息
                let keep_recent = 4.min(messages.len() - 1);
                let compress_end = messages.len() - keep_recent;
                if compress_end > 1 {
                    // 构建待压缩文本
                    let mut summary_input = String::new();
                    for msg in &messages[1..compress_end] {
                        let role = &msg.role;
                        let text = match &msg.content {
                            crate::services::ai_service::ChatContent::Text(t) => t.clone(),
                            crate::services::ai_service::ChatContent::Parts(parts) => parts
                                .iter()
                                .filter_map(|p| match p {
                                    crate::services::ai_service::ContentPart::Text { text } => {
                                        Some(text.as_str())
                                    }
                                    _ => None,
                                })
                                .collect::<Vec<_>>()
                                .join(" "),
                        };
                        if !text.is_empty() {
                            summary_input.push_str(&format!("[{role}]: {text}\n"));
                        }
                    }

                    // 使用 AI 生成摘要
                    let summary_prompt = format!(
                        "Compress the following conversation into a concise summary (max 500 words). \
                         Preserve key facts, decisions, tool results, and context needed for continuation. \
                         Output ONLY the summary, no meta-commentary.\n\n{summary_input}"
                    );
                    let summary_msgs = vec![ChatMessage::user(&summary_prompt)];
                    let summary_result = ai.chat_with_tools(ai_config, &summary_msgs, &[]).await;

                    if let Ok(crate::services::ai_service::AiChatResult::Text(summary, _)) =
                        summary_result
                    {
                        // 持久化压缩：将被压缩的消息标记为 is_active=0，插入摘要 system 消息到 DB
                        let _ = chat_service
                            .persist_compression(session_id, keep_recent, &summary)
                            .await;

                        // 替换压缩区域为摘要（内存中）
                        let system_msg = messages.remove(0);
                        let recent: Vec<ChatMessage> = messages.split_off(compress_end - 1);
                        messages.clear();
                        messages.push(system_msg);
                        messages.push(ChatMessage::system(format!(
                            "[Conversation Summary]\n{summary}"
                        )));
                        messages.extend(recent);

                        // 更新上下文用量（压缩后 token 数变小）
                        last_ctx_used =
                            (crate::services::token_counter::TokenCounter::count_messages(
                                &messages,
                            ) + tool_tokens) as u64;

                        eprintln!(
                            "Chat {}: compressed {} messages (est. {} tokens → {})",
                            session_id,
                            compress_end - 1,
                            total,
                            last_ctx_used,
                        );
                    }
                }
            }

            // ── 流式 AI 调用 ──────────────────────────────────────────────────────
            let stream_msg_id = uuid::Uuid::new_v4().to_string();
            emit_message_start(app, session_id, &stream_msg_id);

            let mut rx = ai.chat_with_tools_stream(ai_config, messages.clone(), tools.clone());

            let mut text_buf = String::new();
            // 合批缓冲：累积 TextDelta，满 64 字节或 24ms 才 emit 一次，降低 IPC 频率
            let mut delta_buf = String::new();
            let mut last_emit = std::time::Instant::now();
            // index -> (id, name, accumulated_args)
            let mut tool_calls_buf: std::collections::HashMap<usize, (String, String, String)> =
                std::collections::HashMap::new();
            let mut stream_finish_reason = String::new();
            let mut stream_prompt_tokens: Option<i32> = None;
            let mut stream_completion_tokens: Option<i32> = None;
            let mut stream_error: Option<String> = None;

            'stream_loop: while let Some(delta) = rx.recv().await {
                {
                    let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                    if tokens.get(session_id).copied().unwrap_or(false) {
                        cancelled = true;
                        break 'stream_loop;
                    }
                }
                match delta {
                    crate::services::ai_service::AiChatDelta::TextDelta(t) => {
                        text_buf.push_str(&t);
                        delta_buf.push_str(&t);
                        let should_flush = delta_buf.len() >= 64
                            || last_emit.elapsed() >= std::time::Duration::from_millis(24);
                        if should_flush {
                            emit_message_delta(
                                app,
                                session_id,
                                &stream_msg_id,
                                "text",
                                Some(&delta_buf),
                                None,
                                None,
                            );
                            delta_buf.clear();
                            last_emit = std::time::Instant::now();
                        }
                    }
                    crate::services::ai_service::AiChatDelta::ToolCallStart { index, id, name } => {
                        // 工具调用前先 flush 剩余文本 delta
                        if !delta_buf.is_empty() {
                            emit_message_delta(
                                app,
                                session_id,
                                &stream_msg_id,
                                "text",
                                Some(&delta_buf),
                                None,
                                None,
                            );
                            delta_buf.clear();
                        }
                        tool_calls_buf.insert(index, (id, name.clone(), String::new()));
                        emit_message_delta(
                            app,
                            session_id,
                            &stream_msg_id,
                            "tool_start",
                            None,
                            Some(index as u32),
                            Some(&name),
                        );
                    }
                    crate::services::ai_service::AiChatDelta::ToolCallArgsDelta {
                        index,
                        delta,
                    } => {
                        if let Some(entry) = tool_calls_buf.get_mut(&index) {
                            entry.2.push_str(&delta);
                        }
                    }
                    crate::services::ai_service::AiChatDelta::Usage(u) => {
                        if u.prompt_tokens.is_some() {
                            stream_prompt_tokens = u.prompt_tokens;
                        }
                        if u.completion_tokens.is_some() {
                            stream_completion_tokens = u.completion_tokens;
                        }
                    }
                    crate::services::ai_service::AiChatDelta::Done { finish_reason } => {
                        stream_finish_reason = finish_reason;
                        break 'stream_loop;
                    }
                    crate::services::ai_service::AiChatDelta::Error(e) => {
                        stream_error = Some(e);
                        break 'stream_loop;
                    }
                }
            }

            // flush 剩余 delta（取消时不 emit，避免生成结束后出现幽灵更新）
            if !cancelled && !delta_buf.is_empty() {
                emit_message_delta(
                    app,
                    session_id,
                    &stream_msg_id,
                    "text",
                    Some(&delta_buf),
                    None,
                    None,
                );
            }

            if !cancelled {
                if let Some(err_msg) = stream_error {
                    if is_image_input_unsupported_error(&err_msg)
                        && !image_input_downgrade_retry_attempted
                    {
                        image_input_downgrade_retry_attempted = true;
                        downgrade_all_tool_images_to_text(&mut messages);
                        logger::info(
                            "ai-chat",
                            format!(
                                "Image input unsupported, downgraded tool images and retrying once (session={})",
                                session_id
                            ),
                        );
                        continue;
                    }
                    logger::error(
                        "ai-chat",
                        format!("Generation error: {} (session={})", err_msg, session_id),
                    );
                    let user_msg = format!("⚠ AI 请求失败: {err_msg}");
                    let _ = chat_service
                        .add_message(
                            session_id,
                            "system",
                            Some(user_msg),
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
                        .await;
                    emit_phase(
                        app,
                        session_id,
                        "error",
                        round,
                        None,
                        Some(err_msg),
                        generation_start.elapsed().as_millis() as u64,
                        Some(cumulative_prompt_tokens),
                        Some(cumulative_completion_tokens),
                        Some(last_ctx_used),
                        Some(last_ctx_limit),
                        MAX_ROUNDS,
                    );
                    completed = true;
                    break;
                } else if stream_finish_reason != "tool_calls" {
                    // 文本回复（stop / end_turn / empty）
                    let model_name = ai_config.model.as_deref().unwrap_or("");
                    let (thinking_text, final_text) =
                        if model_name.contains("deepseek") || model_name.contains("r1") {
                            crate::services::ai_service::extract_deepseek_thinking(&text_buf)
                        } else {
                            (None, text_buf.clone())
                        };

                    // 文本回复按模型原始输出保存；空文本也不做自救或停滞改写。
                    let thinking_tokens = thinking_text.as_ref().map(|t| {
                        crate::services::token_counter::TokenCounter::count_text(t) as i32
                    });
                    let msg = chat_service
                        .add_message_with_id(
                            &stream_msg_id,
                            session_id,
                            "assistant",
                            Some(final_text.clone()),
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
                        .map_err(|e| e.to_string())?;
                    let _ = chat_service
                        .update_message_usage(
                            &msg.id,
                            stream_prompt_tokens,
                            stream_completion_tokens,
                        )
                        .await;
                    if thinking_text.is_some() {
                        let _ = chat_service
                            .update_message_thinking(&msg.id, thinking_text, thinking_tokens)
                            .await;
                    }
                    cumulative_prompt_tokens += stream_prompt_tokens.unwrap_or(0);
                    cumulative_completion_tokens += stream_completion_tokens.unwrap_or(0);
                    let refreshed_msg = chat_service.get_message(&msg.id).await.unwrap_or(msg);
                    emit_message(app, session_id, &refreshed_msg);
                    messages.push(crate::services::ai_service::ChatMessage::assistant(
                        &final_text,
                    ));
                    logger::info(
                        "ai-chat",
                        format!(
                            "Generation done: rounds={} tokens={}/{} reason=normal (session={})",
                            round,
                            cumulative_prompt_tokens,
                            cumulative_completion_tokens,
                            session_id
                        ),
                    );
                    emit_phase(
                        app,
                        session_id,
                        "done",
                        round,
                        None,
                        None,
                        generation_start.elapsed().as_millis() as u64,
                        Some(cumulative_prompt_tokens),
                        Some(cumulative_completion_tokens),
                        Some(last_ctx_used),
                        Some(last_ctx_limit),
                        MAX_ROUNDS,
                    );
                    completed = true;
                    break;
                } else {
                    // 工具调用结果
                    cumulative_prompt_tokens += stream_prompt_tokens.unwrap_or(0);
                    cumulative_completion_tokens += stream_completion_tokens.unwrap_or(0);
                    emit_phase(
                        app,
                        session_id,
                        "tool_calling",
                        round,
                        None,
                        None,
                        generation_start.elapsed().as_millis() as u64,
                        Some(cumulative_prompt_tokens),
                        Some(cumulative_completion_tokens),
                        Some(last_ctx_used),
                        Some(last_ctx_limit),
                        MAX_ROUNDS,
                    );
                    // 从流式数据构建 calls
                    let mut sorted_indices: Vec<usize> = tool_calls_buf.keys().copied().collect();
                    sorted_indices.sort();
                    let calls: Vec<crate::services::ai_service::AiToolCall> = sorted_indices
                        .iter()
                        .filter_map(|idx| {
                            let (id, name, args_str) = tool_calls_buf.get(idx)?;
                            let arguments: Value =
                                serde_json::from_str(args_str).unwrap_or(json!({}));
                            let raw = json!({
                                "id": id,
                                "type": "function",
                                "function": {"name": name, "arguments": args_str},
                            });
                            Some(crate::services::ai_service::AiToolCall {
                                id: id.clone(),
                                name: name.clone(),
                                arguments,
                                raw,
                            })
                        })
                        .collect();
                    let raw_tool_calls: Vec<Value> = calls.iter().map(|c| c.raw.clone()).collect();
                    let tool_calls_str = serde_json::to_string(&raw_tool_calls).ok();
                    // 无文本计数：进入工具分支即代表本轮没有 assistant 文本
                    rounds_since_last_text += 1;
                    let asst_msg = chat_service
                        .add_message_with_id(
                            &stream_msg_id,
                            session_id,
                            "assistant",
                            if text_buf.is_empty() {
                                None
                            } else {
                                Some(text_buf.clone())
                            },
                            tool_calls_str,
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
                        .map_err(|e| e.to_string())?;
                    let _ = chat_service
                        .update_message_usage(
                            &asst_msg.id,
                            stream_prompt_tokens,
                            stream_completion_tokens,
                        )
                        .await;
                    let refreshed_asst_msg = chat_service
                        .get_message(&asst_msg.id)
                        .await
                        .unwrap_or(asst_msg);
                    emit_message(app, session_id, &refreshed_asst_msg);
                    messages.push(crate::services::ai_service::ChatMessage {
                        role: "assistant".into(),
                        content: crate::services::ai_service::ChatContent::Text(text_buf.clone()),
                        tool_calls: Some(raw_tool_calls),
                        tool_call_id: None,
                        name: None,
                    });
                    // 执行每个工具
                    // 本轮内若启动工具（app_start_profile / app_set_chat_active_profile）失败，
                    // 后续依赖浏览器会话的 cdp_* / magic_* 工具直接跳过，避免无效执行。
                    let mut round_startup_failed: Option<String> = None;
                    for tool_call in &calls {
                        // 检查取消
                        {
                            let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                            if tokens.get(session_id).copied().unwrap_or(false) {
                                cancelled = true;
                                break;
                            }
                        }

                        // 若本轮内启动工具已失败，跳过依赖浏览器会话的工具
                        if let Some(ref failed_name) = round_startup_failed {
                            let cat = crate::services::ai_tools::tool_category(&tool_call.name);
                            if matches!(cat, "cdp" | "magic") {
                                let skip_text = format!(
                                    "skipped: {} failed earlier in this round. \
                                     Fix the startup error before issuing browser tools.",
                                    failed_name
                                );
                                let tool_msg = chat_service
                                    .add_message(
                                        session_id,
                                        "tool",
                                        None,
                                        None,
                                        Some(tool_call.id.clone()),
                                        Some(tool_call.name.clone()),
                                        serde_json::to_string(&tool_call.arguments).ok(),
                                        Some(skip_text.clone()),
                                        Some("skipped".to_string()),
                                        Some(0i64),
                                        None,
                                        None,
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                emit_message(app, session_id, &tool_msg);
                                messages.push(ChatMessage::tool_result(&tool_call.id, &skip_text));
                                continue;
                            }
                        }

                        emit_phase(
                            app,
                            session_id,
                            "tool_calling",
                            round,
                            Some(tool_call.name.clone()),
                            None,
                            generation_start.elapsed().as_millis() as u64,
                            Some(cumulative_prompt_tokens),
                            Some(cumulative_completion_tokens),
                            Some(last_ctx_used),
                            Some(last_ctx_limit),
                            MAX_ROUNDS,
                        );
                        logger::info(
                            "ai-chat",
                            format!("Tool call: {} (session={})", tool_call.name, session_id),
                        );

                        let tool_category =
                            crate::services::ai_tools::tool_category(&tool_call.name);
                        if matches!(tool_category, "cdp" | "magic") {
                            let (next_cdp, next_magic_port) = Self::refresh_runtime_binding(
                                app,
                                tool_target_profile_id.as_deref(),
                                false,
                            )
                            .await;
                            cdp_client = next_cdp;
                            magic_port = next_magic_port;
                        }

                        let tool_start = std::time::Instant::now();
                        let step_index = next_tool_step_index;
                        next_tool_step_index += 1;
                        let mut tool_ctx = ToolContext {
                            cdp: cdp_client.as_ref(),
                            http_client: &http_client,
                            magic_port,
                            current_profile_id: tool_target_profile_id.as_deref(),
                            app,
                            run_id: session_id,
                            step_index,
                            vars: &empty_vars,
                            logs: &mut logs,
                            script_ai_config: None,
                        };

                        let (result_text, result_image, tool_status) = {
                            // MCP 工具路由：以 mcp__ 开头的工具名，路由到 McpManager
                            if tool_call.name.starts_with("mcp__") {
                                let mcp_manager =
                                    app.state::<crate::state::AppState>().mcp_manager.clone();
                                // 解析 server_id：从工具名映射回 server
                                let all_tools = mcp_manager.all_enabled_tools().await;
                                let tool_def = all_tools.iter().find(|t| t.name == tool_call.name);
                                match tool_def {
                                    Some(def) => {
                                        let server_id = def.server_id.clone();
                                        let original_name = def.original_name.clone();
                                        let tool_timeout = std::time::Duration::from_secs(60);
                                        match tokio::time::timeout(
                                            tool_timeout,
                                            mcp_manager.call_tool(
                                                &server_id,
                                                &original_name,
                                                tool_call.arguments.clone(),
                                            ),
                                        )
                                        .await
                                        {
                                            Ok(Ok(text)) => (text, None, "completed".to_string()),
                                            Ok(Err(e)) => (
                                                format!("mcp tool error: {e}"),
                                                None,
                                                "failed".to_string(),
                                            ),
                                            Err(_) => (
                                                "MCP tool timed out after 60s".to_string(),
                                                None,
                                                "failed".to_string(),
                                            ),
                                        }
                                    }
                                    None => (
                                        format!(
                                            "MCP tool '{}' not found in any enabled server",
                                            tool_call.name
                                        ),
                                        None,
                                        "failed".to_string(),
                                    ),
                                }
                            } else {
                                let tool_timeout = tool_execution_timeout(&tool_call.name);
                                match tokio::time::timeout(
                                    tool_timeout,
                                    ToolRegistry::execute(
                                        &tool_call.name,
                                        tool_call.arguments.clone(),
                                        &mut tool_ctx,
                                    ),
                                )
                                .await
                                {
                                    Ok(Ok(r)) => {
                                        let txt = r.text.unwrap_or_else(|| "ok".to_string());
                                        // 对 HTML 类工具使用智能截断（先去 script/style，再限长）
                                        // 其余工具按类别截断
                                        let txt = if tool_call.name == "cdp_get_page_source"
                                            || tool_call.name == "cdp_get_full_ax_tree"
                                        {
                                            crate::services::token_counter::truncate_html_result(
                                                &txt, 3_000,
                                            )
                                        } else {
                                            let category = crate::services::ai_tools::tool_category(
                                                &tool_call.name,
                                            );
                                            crate::services::token_counter::truncate_tool_result(
                                                &txt, category,
                                            )
                                        };
                                        (txt, r.image_base64, "completed".to_string())
                                    }
                                    Ok(Err(e)) => {
                                        (format!("tool error: {e}"), None, "failed".to_string())
                                    }
                                    Err(_) => (
                                        format!("Tool timed out after {}s", tool_timeout.as_secs()),
                                        None,
                                        "failed".to_string(),
                                    ),
                                }
                            }
                        };

                        // 维护失败计数器
                        if tool_status == "failed" {
                            *consecutive_tool_failures
                                .entry(tool_call.name.clone())
                                .or_insert(0) += 1;
                            let sig = format!(
                                "{}:{}",
                                tool_call.name,
                                // 按 UTF-8 字符边界安全截断，避免 CJK 多字节字符跨边界 panic
                                {
                                    let max = 120;
                                    if result_text.len() <= max {
                                        result_text.as_str()
                                    } else {
                                        let mut end = max;
                                        while !result_text.is_char_boundary(end) {
                                            end -= 1;
                                        }
                                        &result_text[..end]
                                    }
                                }
                            );
                            *error_signature_repeats.entry(sig).or_insert(0) += 1;
                            // 启动类工具失败：标记本轮，后续 cdp_*/magic_* 将被短路跳过
                            if matches!(
                                tool_call.name.as_str(),
                                "app_start_profile" | "app_set_chat_active_profile"
                            ) && round_startup_failed.is_none()
                            {
                                round_startup_failed = Some(tool_call.name.clone());
                            }
                        } else {
                            consecutive_tool_failures.remove(&tool_call.name);
                        }

                        let duration_ms = tool_start.elapsed().as_millis() as i64;
                        logger::info(
                            "ai-chat",
                            format!(
                                "Tool result: {} status={} ({}ms) (session={})",
                                tool_call.name, tool_status, duration_ms, session_id
                            ),
                        );
                        let image_ref = externalized_chat_tool_image_ref(
                            &tool_call.name,
                            &tool_status,
                            &result_text,
                            result_image.as_ref(),
                        );
                        let stored_image_base64 = if image_ref.is_some() {
                            None
                        } else {
                            result_image.clone()
                        };

                        // app_set_chat_active_profile 成功后切换当前工具目标环境并刷新运行态绑定
                        if tool_call.name == "app_set_chat_active_profile"
                            && tool_status == "completed"
                        {
                            tool_target_profile_id = tool_call
                                .arguments
                                .get("profile_id")
                                .and_then(|value| value.as_str())
                                .map(str::to_string);
                            let (next_cdp, next_magic_port) = Self::refresh_runtime_binding(
                                app,
                                tool_target_profile_id.as_deref(),
                                false,
                            )
                            .await;
                            cdp_client = next_cdp;
                            magic_port = next_magic_port;
                        }
                        // app_start_profile 成功后刷新当前工具目标环境的 CDP 连接（浏览器刚启动，需等待端口就绪）
                        if tool_call.name == "app_start_profile" && tool_status == "completed" {
                            let started_profile_id = tool_call
                                .arguments
                                .get("profile_id")
                                .and_then(|value| value.as_str());
                            if started_profile_id == tool_target_profile_id.as_deref() {
                                let (next_cdp, next_magic_port) = Self::refresh_runtime_binding(
                                    app,
                                    tool_target_profile_id.as_deref(),
                                    true,
                                )
                                .await;
                                cdp_client = next_cdp;
                                magic_port = next_magic_port;
                            }
                        }
                        // app_stop_profile 成功后，如停止的是当前工具目标环境，则清空运行态绑定
                        if tool_call.name == "app_stop_profile" && tool_status == "completed" {
                            let stopped_profile_id = tool_call
                                .arguments
                                .get("profile_id")
                                .and_then(|value| value.as_str());
                            if stopped_profile_id == tool_target_profile_id.as_deref() {
                                cdp_client = None;
                                magic_port = None;
                            }
                        }

                        // 保存工具结果消息
                        let tool_msg = chat_service
                            .add_message(
                                session_id,
                                "tool",
                                None,
                                None,
                                Some(tool_call.id.clone()),
                                Some(tool_call.name.clone()),
                                serde_json::to_string(&tool_call.arguments).ok(),
                                Some(result_text.clone()),
                                Some(tool_status.clone()),
                                Some(duration_ms),
                                stored_image_base64,
                                image_ref,
                            )
                            .await
                            .map_err(|e| e.to_string())?;
                        emit_message(app, session_id, &tool_msg);

                        // 追加工具结果到 messages 历史
                        if let Some(img) = result_image {
                            messages.push(ChatMessage::tool_result_with_image(
                                &tool_call.id,
                                &result_text,
                                &img,
                            ));
                        } else {
                            messages.push(ChatMessage::tool_result(&tool_call.id, &result_text));
                        }

                        if tool_status == "failed"
                            && matches!(
                                tool_call.name.as_str(),
                                "captcha_solve_and_inject" | "captcha_inject_token"
                            )
                        {
                            messages.push(ChatMessage::system(
                                captcha_failure_report_prompt(locale).as_str(),
                            ));
                            escalation_injected = true;
                        }

                        // 重复操作检测：如果最近 6 次中同一 (tool, args) 出现 >= 3 次，注入警告
                        let args_key =
                            serde_json::to_string(&tool_call.arguments).unwrap_or_default();
                        let call_key = (tool_call.name.clone(), args_key);
                        if recent_tool_calls.len() >= 10 {
                            recent_tool_calls.pop_front();
                        }
                        recent_tool_calls.push_back(call_key.clone());
                        if recent_tool_calls.len() >= 6 {
                            let window: Vec<_> = recent_tool_calls.iter().rev().take(6).collect();
                            let repeat_count = window.iter().filter(|k| **k == &call_key).count();
                            if repeat_count >= 3 {
                                let warning = format!(
                                    "⚠ 系统警告：你已连续多次（{}次）用相同参数调用 `{}`，但页面可能没有变化。\n\
                                    请停下来重新评估策略：\n\
                                    1. 调用 cdp_screenshot 确认页面是否真的在变化\n\
                                    2. 尝试完全不同的方法（如直接 URL 访问、用 cdp_execute_js 操作、或换关键词搜索）\n\
                                    3. 如果无法继续，向用户说明当前遇到的具体阻碍",
                                    repeat_count,
                                    tool_call.name
                                );
                                messages.push(ChatMessage::system(&warning));
                                recent_tool_calls.clear();
                                completed = true;
                                break; // break 内层 for tool_call in &calls
                            }
                        }

                        // 失败升级检测：工具连续失败或同一错误重复超限，注入决策 prompt（不 break）
                        if !escalation_injected {
                            use crate::services::agent_limits::{
                                MAX_CONSECUTIVE_TOOL_FAILURES, MAX_SAME_ERROR_REPEATS,
                            };
                            let fail_count = consecutive_tool_failures
                                .get(&tool_call.name)
                                .copied()
                                .unwrap_or(0);
                            if fail_count >= MAX_CONSECUTIVE_TOOL_FAILURES {
                                let prefix = format!("{}:", tool_call.name);
                                let last_errors: Vec<String> = error_signature_repeats
                                    .keys()
                                    .filter(|k| k.starts_with(&prefix))
                                    .map(|k| k[prefix.len()..].to_string())
                                    .take(3)
                                    .collect();
                                let prompt = crate::services::agent_limits::build_escalation_prompt(
                                    &tool_call.name,
                                    fail_count,
                                    &last_errors,
                                    locale,
                                );
                                messages.push(ChatMessage::system(&prompt));
                                escalation_injected = true;
                                consecutive_tool_failures.remove(&tool_call.name);
                                let prefix_owned = prefix;
                                error_signature_repeats
                                    .retain(|k, _| !k.starts_with(&prefix_owned));
                            } else {
                                // 检查是否有同一错误重复次数超限
                                let repeating_key = error_signature_repeats
                                    .iter()
                                    .find(|(_, &v)| v >= MAX_SAME_ERROR_REPEATS)
                                    .map(|(k, _)| k.clone());
                                if let Some(sig) = repeating_key {
                                    let colon = sig.find(':').unwrap_or(sig.len());
                                    let repeated_tool = sig[..colon].to_string();
                                    let error_snippet = sig[colon + 1..].to_string();
                                    let prompt =
                                        crate::services::agent_limits::build_escalation_prompt(
                                            &repeated_tool,
                                            MAX_SAME_ERROR_REPEATS,
                                            &[error_snippet],
                                            locale,
                                        );
                                    messages.push(ChatMessage::system(&prompt));
                                    escalation_injected = true;
                                    let prefix = format!("{repeated_tool}:");
                                    error_signature_repeats.retain(|k, _| !k.starts_with(&prefix));
                                }
                            }
                        }
                    }

                    // 无文本说明检测：连续 N 轮只调工具但不给用户文字说明，注入进度提醒（仅一次）
                    if !assistant_text_nudge_injected
                        && rounds_since_last_text
                            >= crate::services::agent_limits::MAX_ROUNDS_WITHOUT_ASSISTANT_TEXT
                    {
                        let prompt = crate::services::agent_limits::build_no_text_nudge_prompt(
                            rounds_since_last_text,
                            locale,
                        );
                        messages.push(ChatMessage::system(&prompt));
                        assistant_text_nudge_injected = true;
                    }

                    // 内层工具循环取消或完成后，退出外层轮次循环
                    if cancelled || completed {
                        break;
                    }
                }
            }
        }

        // 取消时发送终止事件，确保前端退出"生成中"状态
        if cancelled || !completed {
            emit_phase(
                app,
                session_id,
                "done",
                round,
                None,
                None,
                generation_start.elapsed().as_millis() as u64,
                Some(cumulative_prompt_tokens),
                Some(cumulative_completion_tokens),
                Some(last_ctx_used),
                Some(last_ctx_limit),
                MAX_ROUNDS,
            );
        }

        // 清除取消标志
        {
            let mut tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
            tokens.remove(session_id);
        }

        Ok(())
    }

    /// 尝试获取 Profile 的 CdpClient
    fn try_get_cdp_client(app: &AppHandle, profile_id: &str) -> Option<CdpClient> {
        let state = app.state::<crate::state::AppState>();
        let manager = state.lock_engine_manager();
        let handle = manager.get_runtime_handle(profile_id).ok()?;
        let debug_port = handle.debug_port?;
        Some(CdpClient::new(debug_port))
    }

    /// 尝试获取 Profile 的 Magic Controller 端口
    fn try_get_magic_port(app: &AppHandle, profile_id: &str) -> Option<u16> {
        let state = app.state::<crate::state::AppState>();
        let manager = state.lock_engine_manager();
        let handle = manager.get_runtime_handle(profile_id).ok()?;
        handle.magic_port
    }

    async fn connect_browser_runtime(
        app: &AppHandle,
        session_id: &str,
        profile_id: Option<&str>,
        ai_config: &AiProviderConfig,
        chat_service: &crate::services::chat_service::ChatService,
    ) -> (Option<CdpClient>, Option<u16>) {
        let Some(profile_id) = profile_id else {
            return (None, None);
        };

        let magic_port = Self::try_get_magic_port(app, profile_id);
        let cdp = Self::try_get_cdp_client(app, profile_id);
        if cdp.is_none() {
            let is_db_running = {
                let state = app.state::<crate::state::AppState>();
                let ps = state
                    .profile_service
                    .lock()
                    .unwrap_or_else(|p| p.into_inner());
                ps.ensure_profile_openable(profile_id).is_err()
            };
            if is_db_running {
                let locale = ai_config.locale.as_deref().unwrap_or("zh");
                let warn_msg = if locale.starts_with("en") {
                    "⚠ Browser is running but CDP connection lost (app may have restarted). Browser tools are unavailable. Please close and reopen the browser profile to restore CDP."
                } else {
                    "⚠ 当前工具目标环境正在运行，但 CDP 连接已丢失（可能是应用重启导致）。请关闭并重新打开该环境以恢复浏览器工具能力。"
                };
                let _ = chat_service
                    .add_message(
                        session_id,
                        "system",
                        Some(warn_msg.to_string()),
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
                    .await;
            }
            return (None, magic_port);
        }

        let cdp = Self::wait_for_cdp_ready(cdp, 10, 500).await;
        (cdp, magic_port)
    }

    async fn refresh_runtime_binding(
        app: &AppHandle,
        profile_id: Option<&str>,
        wait_for_cdp: bool,
    ) -> (Option<CdpClient>, Option<u16>) {
        let Some(profile_id) = profile_id else {
            return (None, None);
        };
        let magic_port = Self::try_get_magic_port(app, profile_id);
        let cdp = Self::wait_for_cdp_ready(
            Self::try_get_cdp_client(app, profile_id),
            if wait_for_cdp { 16 } else { 1 },
            500,
        )
        .await;
        (cdp, magic_port)
    }

    async fn wait_for_cdp_ready(
        cdp: Option<CdpClient>,
        max_attempts: usize,
        delay_ms: u64,
    ) -> Option<CdpClient> {
        let client = cdp?;
        let probe_url = format!("http://127.0.0.1:{}/json/list", client.debug_port());
        let probe_client = reqwest::Client::new();
        let attempts = max_attempts.max(1);
        for attempt in 0..attempts {
            if let Ok(resp) = probe_client.get(&probe_url).send().await {
                if resp.status().is_success() {
                    return Some(client);
                }
            }
            if attempt + 1 < attempts {
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
        }
        None
    }
}

/// 从 AiConfigEntry 转换为 AiProviderConfig
pub fn ai_config_entry_to_provider_config(entry: &AiConfigEntry) -> AiProviderConfig {
    AiProviderConfig {
        provider: entry.provider.clone(),
        base_url: entry.base_url.clone(),
        api_key: entry.api_key.clone(),
        model: entry.model.clone(),
        locale: entry.locale.clone(),
    }
}

// ─── Tauri event 发送工具函数 ─────────────────────────────────────────────

fn emit_message(
    app: &AppHandle,
    session_id: &str,
    msg: &crate::services::chat_service::ChatMessageRecord,
) {
    let _ = app.emit(
        "ai_chat://message",
        ChatMessageEvent {
            session_id: session_id.to_string(),
            message: msg.clone(),
        },
    );
}

fn emit_phase(
    app: &AppHandle,
    session_id: &str,
    phase: &str,
    round: u32,
    tool_name: Option<String>,
    error: Option<String>,
    elapsed_ms: u64,
    prompt_tokens: Option<i32>,
    completion_tokens: Option<i32>,
    context_used: Option<u64>,
    context_limit: Option<u64>,
    max_rounds: u32,
) {
    let _ = app.emit(
        "ai_chat://phase",
        ChatPhaseEvent {
            session_id: session_id.to_string(),
            phase: phase.to_string(),
            round,
            max_rounds,
            tool_name,
            error,
            elapsed_ms,
            prompt_tokens,
            completion_tokens,
            context_used,
            context_limit,
        },
    );
}

fn emit_message_start(app: &AppHandle, session_id: &str, message_id: &str) {
    use crate::services::chat_service::ChatMessageRecord;
    let now = crate::models::now_ts();
    let placeholder = ChatMessageRecord {
        id: message_id.to_string(),
        session_id: session_id.to_string(),
        role: "assistant".to_string(),
        content_text: Some(String::new()),
        tool_calls_json: None,
        tool_call_id: None,
        tool_name: None,
        tool_args_json: None,
        tool_result: None,
        tool_status: None,
        tool_duration_ms: None,
        image_base64: None,
        is_active: true,
        created_at: now,
        sort_order: i64::MAX,
        thinking_text: None,
        thinking_tokens: None,
        image_ref: None,
        prompt_tokens: None,
        completion_tokens: None,
    };
    let _ = app.emit(
        "ai_chat://message_start",
        ChatMessageEvent {
            session_id: session_id.to_string(),
            message: placeholder,
        },
    );
}

fn emit_message_delta(
    app: &AppHandle,
    session_id: &str,
    message_id: &str,
    kind: &str,
    delta: Option<&str>,
    tool_call_index: Option<u32>,
    tool_name: Option<&str>,
) {
    let _ = app.emit(
        "ai_chat://message_delta",
        ChatMessageDeltaEvent {
            session_id: session_id.to_string(),
            message_id: message_id.to_string(),
            kind: kind.to_string(),
            delta: delta.map(|s| s.to_string()),
            tool_call_index,
            tool_name: tool_name.map(|s| s.to_string()),
        },
    );
}

fn is_image_input_unsupported_error(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("image input")
        && (normalized.contains("not support")
            || normalized.contains("not found")
            || normalized.contains("unsupported")
            || normalized.contains("no endpoints found"))
}

fn model_should_downgrade_tool_images(provider: &str, model: &str) -> bool {
    let provider = provider.to_ascii_lowercase();
    let model = model.to_ascii_lowercase();
    provider.contains("moonshot")
        || model.contains("kimi")
        || model.contains("k2")
        || model.contains("moonshot")
}

fn prepare_messages_for_chat_model(messages: &mut [ChatMessage], provider: &str, model: &str) {
    if model_should_downgrade_tool_images(provider, model) {
        downgrade_all_tool_images_to_text(messages);
    } else {
        retain_recent_tool_images(messages, 3);
    }
}

fn downgrade_all_tool_images_to_text(messages: &mut [ChatMessage]) {
    for message in messages.iter_mut() {
        if tool_message_has_image(message) {
            downgrade_tool_message_to_text(message);
        }
    }
}

fn captcha_failure_report_prompt(locale: &str) -> String {
    if locale.starts_with("en") {
        "CAPTCHA verification failed at the page level. Do not silently retry or call unrelated tools. Immediately tell the user that the token was injected but the page still blocks verification, summarize the diagnostic reason, and ask for human intervention if needed.".to_string()
    } else {
        "验证码页面级验证失败。不要静默重试，也不要调用无关工具。必须立即告诉用户：token 已注入但页面仍未通过验证，并概括诊断原因；如无法继续，申请人工介入。".to_string()
    }
}

fn retain_recent_tool_images(messages: &mut [ChatMessage], keep: usize) {
    let mut preserved = 0usize;

    for message in messages.iter_mut().rev() {
        if !tool_message_has_image(message) {
            continue;
        }

        if preserved < keep {
            preserved += 1;
            continue;
        }

        downgrade_tool_message_to_text(message);
    }
}

fn tool_message_has_image(message: &ChatMessage) -> bool {
    if message.role != "tool" {
        return false;
    }

    matches!(
        &message.content,
        crate::services::ai_service::ChatContent::Parts(parts)
            if parts.iter().any(|part| matches!(
                part,
                crate::services::ai_service::ContentPart::ImageUrl { .. }
            ))
    )
}

fn downgrade_tool_message_to_text(message: &mut ChatMessage) {
    let text = match &message.content {
        crate::services::ai_service::ChatContent::Text(text) => text.clone(),
        crate::services::ai_service::ChatContent::Parts(parts) => parts
            .iter()
            .find_map(|part| match part {
                crate::services::ai_service::ContentPart::Text { text } => Some(text.clone()),
                _ => None,
            })
            .unwrap_or_default(),
    };

    message.content = crate::services::ai_service::ChatContent::Text(text);
}

fn externalized_chat_tool_image_ref(
    tool_name: &str,
    tool_status: &str,
    result_text: &str,
    image_base64: Option<&String>,
) -> Option<String> {
    if tool_status != "completed" || image_base64.is_none() {
        return None;
    }

    match tool_name {
        "cdp_screenshot" | "magic_capture_app_shell" | "screenshot" => {
            Some(result_text.to_string())
        }
        _ => None,
    }
}

/// 根据工具类别返回执行超时时间
fn tool_execution_timeout(tool_name: &str) -> std::time::Duration {
    let category = crate::services::ai_tools::tool_category(tool_name);
    let secs = match category {
        "cdp" => 60,
        "dialog" => 300,
        "captcha" => 120,
        _ => 30,
    };
    std::time::Duration::from_secs(secs)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tool_image_message(id: &str, text: &str) -> ChatMessage {
        ChatMessage::tool_result_with_image(id, text, "ZmFrZS1pbWFnZQ==")
    }

    #[test]
    fn retain_recent_tool_images_only_keeps_latest_visual_context() {
        let mut messages = vec![
            ChatMessage::user("open page"),
            tool_image_message("tool_1", "/tmp/shot-1.png"),
            tool_image_message("tool_2", "/tmp/shot-2.png"),
            tool_image_message("tool_3", "/tmp/shot-3.png"),
        ];

        retain_recent_tool_images(&mut messages, 1);

        assert!(matches!(
            &messages[1].content,
            crate::services::ai_service::ChatContent::Text(text)
                if text == "/tmp/shot-1.png"
        ));
        assert!(matches!(
            &messages[2].content,
            crate::services::ai_service::ChatContent::Text(text)
                if text == "/tmp/shot-2.png"
        ));
        assert!(matches!(
            &messages[3].content,
            crate::services::ai_service::ChatContent::Parts(parts)
                if parts.iter().any(|part| matches!(
                    part,
                    crate::services::ai_service::ContentPart::ImageUrl { .. }
            ))
        ));
    }

    #[test]
    fn image_input_unsupported_error_is_detected() {
        assert!(is_image_input_unsupported_error(
            "AI API error 404 Not Found: {\"error\":{\"message\":\"No endpoints found that support image input\"}}"
        ));
        assert!(!is_image_input_unsupported_error(
            "AI API error 500: temporary failure"
        ));
    }

    #[test]
    fn text_only_models_downgrade_tool_images_before_streaming() {
        let mut messages = vec![
            ChatMessage::user("inspect"),
            tool_image_message("tool_1", "/tmp/shot.png"),
        ];

        prepare_messages_for_chat_model(&mut messages, "openai", "kimi-k2.5");

        assert!(matches!(
            &messages[1].content,
            crate::services::ai_service::ChatContent::Text(text)
                if text == "/tmp/shot.png"
        ));
    }

    #[test]
    fn image_input_unsupported_retry_downgrades_all_tool_images() {
        let mut messages = vec![
            ChatMessage::user("inspect"),
            tool_image_message("tool_1", "/tmp/shot.png"),
        ];

        downgrade_all_tool_images_to_text(&mut messages);

        assert!(!tool_message_has_image(&messages[1]));
    }
}
