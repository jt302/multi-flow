//! AI 聊天执行引擎
//!
//! 复用现有 AiService + ToolRegistry 基础设施，为交互式聊天提供 AI tool calling 循环。
//! 与 AiAgent ScriptStep 的主要区别：
//! - 消息历史从 DB 加载，跨会话持久化
//! - 以自然语言文本回复为结束条件（无 submit_result）
//! - 每条消息/工具调用结果实时保存到 DB
//! - 通过 Tauri events 推送实时进度

use std::collections::HashMap;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::logger;
use crate::services::ai_service::{AiService, ChatMessage};
use crate::services::ai_tools::{ToolContext, ToolFilter, ToolRegistry};
use crate::services::app_preference_service::{AiConfigEntry, AiProviderConfig};
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::models::RunLogEntry;

const MAX_CHAT_ROUNDS: u32 = 30;

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
    pub phase: String,  // "thinking" | "tool_calling" | "done" | "error"
    pub round: u32,
    pub max_rounds: u32,
    pub tool_name: Option<String>,
    pub error: Option<String>,
    pub elapsed_ms: u64,
    pub prompt_tokens: Option<i32>,
    pub completion_tokens: Option<i32>,
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
        profile_id: Option<&str>,
        ai_config: &AiProviderConfig,
        system_prompt: Option<&str>,
        global_prompt: Option<&str>,
        tool_filter: &ToolFilter,
        cancel_tokens: &std::sync::Mutex<HashMap<String, bool>>,
        profile_ids: Option<&[String]>,
        active_profile_id: Option<&str>,
    ) -> Result<(), String> {
        let chat_service = app
            .state::<crate::state::AppState>()
            .chat_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();

        // 1. 保存用户消息
        let user_msg = chat_service
            .add_message(session_id, "user", Some(user_text.to_string()), None, None, None, None, None, None, None, None)
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
                let ps = state.profile_service.lock().unwrap_or_else(|p| p.into_inner());
                let px = state.proxy_service.lock().unwrap_or_else(|p| p.into_inner());
                let contexts = crate::services::profile_context_service::extract_contexts(
                    pids,
                    active_profile_id,
                    &ps,
                    &px,
                );
                if contexts.is_empty() {
                    None
                } else {
                    Some(crate::services::profile_context_service::format_for_prompt(&contexts, locale))
                }
            } else {
                None
            }
        } else {
            None
        };

        let system_prompt_text = crate::services::ai_prompts::build_chat_system_prompt(
            global_prompt,
            system_prompt,
            &tool_categories,
            locale,
            env_text.as_deref(),
            None, // conversation_summary: Phase C
        );
        messages.insert(0, ChatMessage::system(&system_prompt_text));

        // 4. 获取工具定义
        let tools = ToolRegistry::definitions(tool_filter);
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

        // 6. Tool calling 循环
        let generation_start = std::time::Instant::now();
        let generation_timeout = std::time::Duration::from_secs(300);
        let mut cumulative_prompt_tokens: i32 = 0;
        let mut cumulative_completion_tokens: i32 = 0;
        let mut cancelled = false;
        let mut completed = false;
        for round in 0..MAX_CHAT_ROUNDS {
            // 检查整体超时
            if generation_start.elapsed() > generation_timeout {
                let _ = chat_service.add_message(
                    session_id, "system",
                    Some("⚠ Generation timed out (300s limit reached).".to_string()),
                    None, None, None, None, None, None, None, None,
                ).await;
                emit_phase(app, session_id, "error", round + 1, None,
                    Some("Generation timeout".to_string()),
                    generation_start.elapsed().as_millis() as u64,
                    Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
                break;
            }

            // 检查取消（循环开始时）
            {
                let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                if tokens.get(session_id).copied().unwrap_or(false) {
                    cancelled = true;
                    break;
                }
            }

            emit_phase(app, session_id, "thinking", round + 1, None, None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));

            // 滑动窗口压缩：估算 token 数，若超过上下文 75% 则压缩历史
            let ctx_limit = crate::services::token_counter::TokenCounter::context_limit(
                ai_config.provider.as_deref().unwrap_or(""),
                ai_config.model.as_deref().unwrap_or(""),
            );
            let tool_tokens = crate::services::token_counter::TokenCounter::count_tools(&tools);
            let msg_tokens = crate::services::token_counter::TokenCounter::count_messages(&messages);
            let total = tool_tokens + msg_tokens;
            let threshold = ctx_limit * 3 / 4;

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
                            crate::services::ai_service::ChatContent::Parts(parts) => {
                                parts.iter().filter_map(|p| match p {
                                    crate::services::ai_service::ContentPart::Text { text } => Some(text.as_str()),
                                    _ => None,
                                }).collect::<Vec<_>>().join(" ")
                            }
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
                    let summary_result = ai
                        .chat_with_tools(ai_config, &summary_msgs, &[])
                        .await;

                    if let Ok(crate::services::ai_service::AiChatResult::Text(summary, _)) = summary_result {
                        // 替换压缩区域为摘要
                        let system_msg = messages.remove(0);
                        let recent: Vec<ChatMessage> = messages.split_off(compress_end - 1);
                        messages.clear();
                        messages.push(system_msg);
                        messages.push(ChatMessage::system(&format!("[Conversation Summary]\n{summary}")));
                        messages.extend(recent);

                        eprintln!(
                            "Chat {}: compressed {} messages (est. {} tokens → {})",
                            session_id,
                            compress_end - 1,
                            total,
                            crate::services::token_counter::TokenCounter::count_messages(&messages) + tool_tokens,
                        );
                    }
                }
            }

            let result = ai.chat_with_tools(ai_config, &messages, &tools).await;

            // 检查取消（LLM 调用返回后，防止长时间 HTTP 请求期间的取消被忽略）
            {
                let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                if tokens.get(session_id).copied().unwrap_or(false) {
                    cancelled = true;
                    break;
                }
            }

            match result {
                Err(e) => {
                    let err_msg = e.to_string();
                    logger::error("ai-chat", format!("Generation error: {} (session={})", err_msg, session_id));
                    // 保存错误消息（已经过最多 5 次自动重试仍失败）
                    let user_msg = format!("⚠ AI 请求失败（已自动重试 5 次）: {err_msg}");
                    let _ = chat_service.add_message(
                        session_id,
                        "system",
                        Some(user_msg),
                        None, None, None, None, None, None, None, None,
                    ).await;
                    emit_phase(app, session_id, "error", round + 1, None, Some(err_msg.clone()), generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
                    return Err(err_msg);
                }
                Ok(crate::services::ai_service::AiChatResult::Text(text, usage)) => {
                    // 提取思考过程（DeepSeek R1 <think> 标签）
                    let model = ai_config.model.as_deref().unwrap_or("");
                    let (thinking_text, final_text) = if model.contains("deepseek") || model.contains("r1") {
                        crate::services::ai_service::extract_deepseek_thinking(&text)
                    } else {
                        (None, text)
                    };
                    let thinking_tokens = thinking_text.as_ref().map(|t| {
                        crate::services::token_counter::TokenCounter::count_text(t) as i32
                    });

                    // AI 直接返回文本，保存并结束
                    let msg = chat_service
                        .add_message(session_id, "assistant", Some(final_text), None, None, None, None, None, None, None, None)
                        .await
                        .map_err(|e| e.to_string())?;
                    // 保存 token 用量和思考内容
                    let _ = chat_service.update_message_usage(
                        &msg.id,
                        usage.prompt_tokens,
                        usage.completion_tokens,
                    ).await;
                    if thinking_text.is_some() {
                        let _ = chat_service.update_message_thinking(
                            &msg.id,
                            thinking_text,
                            thinking_tokens,
                        ).await;
                    }
                    cumulative_prompt_tokens += usage.prompt_tokens.unwrap_or(0);
                    cumulative_completion_tokens += usage.completion_tokens.unwrap_or(0);
                    emit_message(app, session_id, &msg);
                    logger::info("ai-chat", format!("Generation done: rounds={} tokens={}/{} (session={})", round + 1, cumulative_prompt_tokens, cumulative_completion_tokens, session_id));
                    emit_phase(app, session_id, "done", round + 1, None, None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
                    completed = true;
                    break;
                }
                Ok(crate::services::ai_service::AiChatResult::ToolCalls { text, calls, usage }) => {
                    cumulative_prompt_tokens += usage.prompt_tokens.unwrap_or(0);
                    cumulative_completion_tokens += usage.completion_tokens.unwrap_or(0);
                    emit_phase(app, session_id, "tool_calling", round + 1, None, None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));

                    // 保存 assistant 消息（含 tool_calls）
                    let raw_tool_calls: Vec<serde_json::Value> =
                        calls.iter().map(|c| c.raw.clone()).collect();
                    let tool_calls_str = serde_json::to_string(&raw_tool_calls).ok();
                    let asst_msg = chat_service
                        .add_message(
                            session_id,
                            "assistant",
                            if text.is_empty() { None } else { Some(text.clone()) },
                            tool_calls_str,
                            None, None, None, None, None, None, None,
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                    // 保存 token 用量
                    let _ = chat_service.update_message_usage(
                        &asst_msg.id,
                        usage.prompt_tokens,
                        usage.completion_tokens,
                    ).await;
                    emit_message(app, session_id, &asst_msg);

                    // 追加到 messages 历史（给 AI 使用）
                    messages.push(ChatMessage {
                        role: "assistant".into(),
                        content: crate::services::ai_service::ChatContent::Text(text),
                        tool_calls: Some(raw_tool_calls),
                        tool_call_id: None,
                        name: None,
                    });

                    // 执行每个工具
                    for tool_call in &calls {
                        // 检查取消
                        {
                            let tokens = cancel_tokens.lock().unwrap_or_else(|p| p.into_inner());
                            if tokens.get(session_id).copied().unwrap_or(false) {
                                cancelled = true;
                                break;
                            }
                        }

                        emit_phase(app, session_id, "tool_calling", round + 1, Some(tool_call.name.clone()), None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
                        logger::info("ai-chat", format!("Tool call: {} (session={})", tool_call.name, session_id));

                        let tool_category = crate::services::ai_tools::tool_category(&tool_call.name);
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
                        let mut tool_ctx = ToolContext {
                            cdp: cdp_client.as_ref(),
                            http_client: &http_client,
                            magic_port,
                            current_profile_id: tool_target_profile_id.as_deref(),
                            app,
                            run_id: session_id,
                            step_index: 0,
                            vars: &empty_vars,
                            logs: &mut logs,
                            script_ai_config: None,
                        };

                        let (result_text, result_image, tool_status) = {
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
                                    // 根据工具类别截断过长结果，防止上下文溢出
                                    let category = crate::services::ai_tools::tool_category(&tool_call.name);
                                    let txt = crate::services::token_counter::truncate_tool_result(&txt, category);
                                    (txt, r.image_base64, "completed".to_string())
                                }
                                Ok(Err(e)) => {
                                    (format!("tool error: {e}"), None, "failed".to_string())
                                }
                                Err(_) => {
                                    (format!("Tool timed out after {}s", tool_timeout.as_secs()), None, "failed".to_string())
                                }
                            }
                        };

                        let duration_ms = tool_start.elapsed().as_millis() as i64;
                        logger::info("ai-chat", format!("Tool result: {} status={} ({}ms) (session={})", tool_call.name, tool_status, duration_ms, session_id));

                        // app_set_chat_active_profile 成功后切换当前工具目标环境并刷新运行态绑定
                        if tool_call.name == "app_set_chat_active_profile" && tool_status == "completed" {
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
                                Some(tool_status),
                                Some(duration_ms),
                                result_image.clone(),
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
                    }

                    // 内层工具循环取消后，也需要退出外层轮次循环
                    if cancelled {
                        break;
                    }
                }
            }
        }

        // 取消时发送终止事件，确保前端退出"生成中"状态
        if cancelled {
            emit_phase(app, session_id, "done", 0, None, None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
        } else if !completed {
            // 30 轮耗尽但未正常完成，发送终止事件防止前端永远卡在"思考中"
            let _ = chat_service.add_message(
                session_id, "system",
                Some("⚠ 已达到最大轮次上限（30 轮），对话自动终止。".to_string()),
                None, None, None, None, None, None, None, None,
            ).await;
            emit_phase(app, session_id, "done", MAX_CHAT_ROUNDS, None, None, generation_start.elapsed().as_millis() as u64, Some(cumulative_prompt_tokens), Some(cumulative_completion_tokens));
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
                let ps = state.profile_service.lock().unwrap_or_else(|p| p.into_inner());
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

fn emit_message(app: &AppHandle, session_id: &str, msg: &crate::services::chat_service::ChatMessageRecord) {
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
) {
    let _ = app.emit(
        "ai_chat://phase",
        ChatPhaseEvent {
            session_id: session_id.to_string(),
            phase: phase.to_string(),
            round,
            max_rounds: MAX_CHAT_ROUNDS,
            tool_name,
            error,
            elapsed_ms,
            prompt_tokens,
            completion_tokens,
        },
    );
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
