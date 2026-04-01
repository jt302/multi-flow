use std::collections::HashMap;
use std::time::{Duration, Instant};

use futures_util::future::BoxFuture;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::profile_commands::do_open_profile;
use crate::logger;
use crate::models::{
    AiOutputKeyMapping, AutomationHumanDismissedEvent, AutomationHumanRequiredEvent,
    AutomationProgressEvent, AutomationRun, AutomationRunCancelledEvent, AutomationScript,
    AutomationStepErrorPauseEvent, AutomationVariablesUpdatedEvent, CreateAutomationScriptRequest,
    LoopMode, ScriptStep, SelectorType, StepResult, WaitForUserTimeout,
};
use crate::services::ai_service::{
    build_agent_tools, build_vision_content, extract_json_path, AiChatResult, AiService,
    ChatMessage,
};
use crate::services::app_preference_service::AiProviderConfig;
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::state::AppState;

fn error_to_string(err: crate::error::AppError) -> String {
    err.to_string()
}

/// CSS 选择器查找元素
async fn find_element_by_css(cdp: &CdpClient, selector: &str) -> Result<i64, String> {
    let doc = cdp.call("DOM.getDocument", json!({ "depth": 0 })).await?;
    let root_id = doc
        .get("root")
        .and_then(|r| r.get("nodeId"))
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "DOM.getDocument: no root nodeId".to_string())?;
    let qs = cdp
        .call(
            "DOM.querySelector",
            json!({ "nodeId": root_id, "selector": selector }),
        )
        .await?;
    let node_id = qs
        .get("nodeId")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| format!("element not found (css): {selector}"))?;
    if node_id == 0 {
        return Err(format!("element not found (css): {selector}"));
    }
    Ok(node_id)
}

/// XPath 查找元素
async fn find_element_by_xpath(cdp: &CdpClient, xpath: &str) -> Result<i64, String> {
    let search = cdp
        .call("DOM.performSearch", json!({ "query": xpath }))
        .await?;
    let search_id = search
        .get("searchId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "DOM.performSearch: no searchId".to_string())?
        .to_string();
    let count = search
        .get("resultCount")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    if count == 0 {
        let _ = cdp
            .call(
                "DOM.discardSearchResults",
                json!({ "searchId": &search_id }),
            )
            .await;
        return Err(format!("element not found (xpath): {xpath}"));
    }
    let results = cdp
        .call(
            "DOM.getSearchResults",
            json!({
                "searchId": &search_id, "fromIndex": 0, "toIndex": 1
            }),
        )
        .await?;
    let _ = cdp
        .call(
            "DOM.discardSearchResults",
            json!({ "searchId": &search_id }),
        )
        .await;
    let node_id = results
        .get("nodeIds")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_i64())
        .ok_or_else(|| format!("element not found (xpath): {xpath}"))?;
    if node_id == 0 {
        return Err(format!("element not found (xpath): {xpath}"));
    }
    Ok(node_id)
}

/// 文本内容匹配查找元素
async fn find_element_by_text(cdp: &CdpClient, text: &str) -> Result<i64, String> {
    let escaped = text.replace('\'', "\\'");
    let xpath = format!("//*[contains(text(), '{escaped}')]");
    find_element_by_xpath(cdp, &xpath)
        .await
        .map_err(|_| format!("element not found (text): {text}"))
}

/// 根据 SelectorType 分派到对应的查找函数
async fn find_element(
    cdp: &CdpClient,
    selector: &str,
    selector_type: &SelectorType,
) -> Result<i64, String> {
    match selector_type {
        SelectorType::Css => find_element_by_css(cdp, selector).await,
        SelectorType::Xpath => find_element_by_xpath(cdp, selector).await,
        SelectorType::Text => find_element_by_text(cdp, selector).await,
    }
}

/// 生成在页面 JS 上下文中查找元素的表达式
fn js_find_element_expr(selector: &str, selector_type: &SelectorType) -> String {
    match selector_type {
        SelectorType::Css => format!("document.querySelector({})", serde_json::to_string(selector).unwrap_or_default()),
        SelectorType::Xpath => format!(
            "document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue",
            serde_json::to_string(selector).unwrap_or_default()
        ),
        SelectorType::Text => {
            let text_json = serde_json::to_string(selector).unwrap_or_default();
            format!(
                "(function(){{ var x = document.evaluate('//*[contains(text(),' + {} + ')]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null); return x.singleNodeValue; }})()",
                text_json
            )
        }
    }
}

/// 点击元素：先尝试 DOM.getBoxModel，失败后回退到 JS getBoundingClientRect
async fn click_element_once(
    cdp: &CdpClient,
    selector: &str,
    selector_type: &SelectorType,
) -> Result<(), String> {
    let box_result = async {
        let node_id = find_element(cdp, selector, selector_type).await?;
        let bm = cdp
            .call("DOM.getBoxModel", json!({ "nodeId": node_id }))
            .await?;
        let content = bm
            .get("model")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_array())
            .ok_or_else(|| "getBoxModel: no content".to_string())?;
        let x = (content[0].as_f64().unwrap_or(0.0) + content[2].as_f64().unwrap_or(0.0)) / 2.0;
        let y = (content[1].as_f64().unwrap_or(0.0) + content[5].as_f64().unwrap_or(0.0)) / 2.0;
        Ok::<(f64, f64), String>((x, y))
    }
    .await;

    let (x, y) = match box_result {
        Ok(coords) => coords,
        Err(_) => {
            let js_expr = js_find_element_expr(selector, selector_type);
            let expr = format!(
                "(function(){{ var el = {js_expr}; if(!el) return null; var r = el.getBoundingClientRect(); return {{x: r.x + r.width/2, y: r.y + r.height/2}}; }})()"
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let value = result
                .get("result")
                .and_then(|r| r.get("value"))
                .ok_or_else(|| format!("element not found: {selector}"))?;
            let cx = value
                .get("x")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| format!("element has no layout: {selector}"))?;
            let cy = value
                .get("y")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| format!("element has no layout: {selector}"))?;
            (cx, cy)
        }
    };

    for ev in ["mousePressed", "mouseReleased"] {
        cdp.call(
            "Input.dispatchMouseEvent",
            json!({ "type": ev, "x": x, "y": y, "button": "left", "clickCount": 1 }),
        )
        .await?;
    }
    Ok(())
}

/// 点击元素，失败时最多重试 3 次（每次间隔 300ms）
async fn click_element(
    cdp: &CdpClient,
    selector: &str,
    selector_type: &SelectorType,
) -> Result<(), String> {
    let mut last_err = String::new();
    for attempt in 0..3u8 {
        match click_element_once(cdp, selector, selector_type).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = e;
                if attempt < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                }
            }
        }
    }
    Err(last_err)
}

/// 读取 AI Provider 配置，并应用步骤级 model_override
/// 优先级：model_override > script_ai_config/ai_config_id > 全局默认
fn load_ai_config(
    app: &AppHandle,
    script_ai_config: Option<&AiProviderConfig>,
    ai_config_id: Option<&String>,
    model_override: Option<&String>,
) -> AiProviderConfig {
    let app_state = app.state::<AppState>();
    let svc = app_state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());

    // Try resolving by ai_config_id first (multi-model)
    let mut config = if let Some(cfg_id) = ai_config_id {
        if let Ok(Some(entry)) = svc.find_ai_config_by_id(cfg_id) {
            AiProviderConfig {
                provider: entry.provider,
                base_url: entry.base_url,
                api_key: entry.api_key,
                model: entry.model,
            }
        } else {
            svc.read_ai_provider_config().unwrap_or_default()
        }
    } else {
        svc.read_ai_provider_config().unwrap_or_default()
    };

    // Legacy script-level inline config override
    if let Some(script_cfg) = script_ai_config {
        if script_cfg.provider.is_some() {
            config.provider = script_cfg.provider.clone();
        }
        if script_cfg.base_url.is_some() {
            config.base_url = script_cfg.base_url.clone();
        }
        if script_cfg.api_key.is_some() {
            config.api_key = script_cfg.api_key.clone();
        }
        if script_cfg.model.is_some() {
            config.model = script_cfg.model.clone();
        }
    }
    if let Some(m) = model_override {
        config.model = Some(m.clone());
    }
    config
}

/// 在脚本执行前，将 ai_config_id 解析为 AiProviderConfig
/// 如果有 ai_config_id 且能找到对应配置，则返回该配置；否则回退到 legacy inline ai_config
fn resolve_script_ai_config(
    app: &AppHandle,
    ai_config_id: Option<&String>,
    legacy_config: Option<AiProviderConfig>,
) -> Option<AiProviderConfig> {
    if let Some(cfg_id) = ai_config_id {
        let app_state = app.state::<AppState>();
        let svc = app_state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Ok(Some(entry)) = svc.find_ai_config_by_id(cfg_id) {
            return Some(AiProviderConfig {
                provider: entry.provider,
                base_url: entry.base_url,
                api_key: entry.api_key,
                model: entry.model,
            });
        }
    }
    legacy_config
}

// ─── Tauri 命令 ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_automation_scripts(
    state: State<'_, AppState>,
) -> Result<Vec<AutomationScript>, String> {
    state
        .lock_automation_service()
        .list_scripts()
        .map_err(error_to_string)
}

#[tauri::command]
pub fn create_automation_script(
    state: State<'_, AppState>,
    payload: CreateAutomationScriptRequest,
) -> Result<AutomationScript, String> {
    state
        .lock_automation_service()
        .create_script(payload)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn update_automation_script(
    state: State<'_, AppState>,
    script_id: String,
    payload: CreateAutomationScriptRequest,
) -> Result<AutomationScript, String> {
    state
        .lock_automation_service()
        .update_script(&script_id, payload)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn delete_automation_script(
    state: State<'_, AppState>,
    script_id: String,
) -> Result<(), String> {
    state
        .lock_automation_service()
        .delete_script(&script_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn list_automation_runs(
    state: State<'_, AppState>,
    script_id: String,
) -> Result<Vec<AutomationRun>, String> {
    state
        .lock_automation_service()
        .list_runs(&script_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn delete_automation_run(state: State<'_, AppState>, run_id: String) -> Result<(), String> {
    state
        .lock_automation_service()
        .delete_run(&run_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn clear_automation_runs(state: State<'_, AppState>, script_id: String) -> Result<u64, String> {
    state
        .lock_automation_service()
        .delete_runs_by_script(&script_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub async fn run_automation_script(
    app: AppHandle,
    state: State<'_, AppState>,
    script_id: String,
    profile_id: Option<String>,
    initial_vars: Option<HashMap<String, String>>,
    delay_config: Option<crate::models::RunDelayConfig>,
) -> Result<String, String> {
    let (steps, steps_json, script_ai_config, associated_profile_ids, step_delay_ms) = {
        let svc = state.lock_automation_service();
        let script = svc.get_script(&script_id).map_err(error_to_string)?;
        let steps_json = serde_json::to_string(&script.steps)
            .map_err(|e| format!("serialize steps failed: {e}"))?;
        let step_delay_ms = script
            .settings
            .as_ref()
            .and_then(|s| s.step_delay_ms)
            .unwrap_or(0);
        let ai_config =
            resolve_script_ai_config(&app, script.ai_config_id.as_ref(), script.ai_config);
        (
            script.steps,
            steps_json,
            ai_config,
            script.associated_profile_ids,
            step_delay_ms,
        )
    };
    let resolved_profile_id = profile_id
        .or_else(|| associated_profile_ids.first().cloned())
        .ok_or_else(|| "未指定环境且脚本无关联环境".to_string())?;
    let (debug_port, magic_port) = {
        let handle_result = {
            let em = state.lock_engine_manager();
            em.get_runtime_handle(&resolved_profile_id)
                .ok()
                .map(|h| (h.debug_port, h.magic_port))
        };
        match handle_result {
            Some(ports) => ports,
            None => {
                logger::info(
                    "automation",
                    format!("auto-starting profile profile_id={}", resolved_profile_id),
                );
                do_open_profile(&state, Some(&app), None, &resolved_profile_id, None)
                    .map_err(|e| format!("自动启动环境失败: {e}"))?;
                logger::info(
                    "automation",
                    format!("profile auto-started profile_id={}", resolved_profile_id),
                );
                let em = state.lock_engine_manager();
                em.get_runtime_handle(&resolved_profile_id)
                    .map(|h| (h.debug_port, h.magic_port))
                    .unwrap_or((None, None))
            }
        }
    };
    let run_id = {
        let svc = state.lock_automation_service();
        svc.create_run(&script_id, &resolved_profile_id, &steps_json)
            .map_err(error_to_string)?
    };
    logger::info(
        "automation",
        format!(
            "script started script_id={} profile_id={} run_id={} steps={}",
            script_id,
            resolved_profile_id,
            run_id,
            steps.len()
        ),
    );
    tauri::async_runtime::spawn(execute_script(
        app,
        run_id.clone(),
        script_id.clone(),
        resolved_profile_id.clone(),
        debug_port,
        magic_port,
        steps,
        initial_vars.unwrap_or_default(),
        script_ai_config,
        step_delay_ms,
        delay_config,
    ));
    Ok(run_id)
}

/// 调试模式：每步执行后插入 WaitForUser 暂停，让用户逐步检查
#[tauri::command]
pub async fn run_automation_script_debug(
    app: AppHandle,
    state: State<'_, AppState>,
    script_id: String,
    profile_id: Option<String>,
    initial_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let (steps, steps_json, script_ai_config, associated_profile_ids, step_delay_ms) = {
        let svc = state.lock_automation_service();
        let script = svc.get_script(&script_id).map_err(error_to_string)?;
        let steps_json = serde_json::to_string(&script.steps)
            .map_err(|e| format!("serialize steps failed: {e}"))?;
        let step_delay_ms = script
            .settings
            .as_ref()
            .and_then(|s| s.step_delay_ms)
            .unwrap_or(0);
        let ai_config =
            resolve_script_ai_config(&app, script.ai_config_id.as_ref(), script.ai_config);
        (
            script.steps,
            steps_json,
            ai_config,
            script.associated_profile_ids,
            step_delay_ms,
        )
    };
    let resolved_profile_id = profile_id
        .or_else(|| associated_profile_ids.first().cloned())
        .ok_or_else(|| "未指定环境且脚本无关联环境".to_string())?;
    // 在每步之后插入调试暂停步骤
    let debug_steps: Vec<ScriptStep> = steps
        .into_iter()
        .flat_map(|step| {
            let kind = match &step {
                ScriptStep::WaitForUser { .. } => None, // 已有等待，不重复插入
                _ => Some(ScriptStep::WaitForUser {
                    message: format!("调试暂停 — 步骤已执行。点击继续运行下一步。"),
                    input_label: None,
                    output_key: None,
                    timeout_ms: None,
                    on_timeout: crate::models::WaitForUserTimeout::Continue,
                }),
            };
            std::iter::once(step).chain(kind)
        })
        .collect();
    let (debug_port, magic_port) = {
        let handle_result = {
            let em = state.lock_engine_manager();
            em.get_runtime_handle(&resolved_profile_id)
                .ok()
                .map(|h| (h.debug_port, h.magic_port))
        };
        match handle_result {
            Some(ports) => ports,
            None => {
                logger::info(
                    "automation",
                    format!("auto-starting profile profile_id={}", resolved_profile_id),
                );
                do_open_profile(&state, Some(&app), None, &resolved_profile_id, None)
                    .map_err(|e| format!("自动启动环境失败: {e}"))?;
                logger::info(
                    "automation",
                    format!("profile auto-started profile_id={}", resolved_profile_id),
                );
                let em = state.lock_engine_manager();
                em.get_runtime_handle(&resolved_profile_id)
                    .map(|h| (h.debug_port, h.magic_port))
                    .unwrap_or((None, None))
            }
        }
    };
    let run_id = {
        let svc = state.lock_automation_service();
        svc.create_run(&script_id, &resolved_profile_id, &steps_json)
            .map_err(error_to_string)?
    };
    logger::info(
        "automation",
        format!(
            "script started (debug) script_id={} profile_id={} run_id={} steps={}",
            script_id,
            resolved_profile_id,
            run_id,
            debug_steps.len()
        ),
    );
    tauri::async_runtime::spawn(execute_script(
        app,
        run_id.clone(),
        script_id.clone(),
        resolved_profile_id.clone(),
        debug_port,
        magic_port,
        debug_steps,
        initial_vars.unwrap_or_default(),
        script_ai_config,
        step_delay_ms,
        None,
    ));
    Ok(run_id)
}

#[tauri::command]
pub async fn resume_automation_run(
    state: State<'_, AppState>,
    run_id: String,
    input: Option<String>,
) -> Result<(), String> {
    let sender = state
        .active_run_channels
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .remove(&run_id);
    match sender {
        Some(tx) => {
            let _ = tx.send(input);
            Ok(())
        }
        None => Err(format!("no waiting run: {run_id}")),
    }
}

#[tauri::command]
pub async fn cancel_automation_run(
    app: AppHandle,
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), String> {
    state
        .cancel_tokens
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .insert(run_id.clone(), true);
    if let Ok(mut channels) = state.active_run_channels.lock() {
        if let Some(tx) = channels.remove(&run_id) {
            let _ = tx.send(None);
        }
    }
    let _ = app.emit(
        "automation_run_cancelled",
        AutomationRunCancelledEvent {
            run_id: run_id.clone(),
        },
    );
    logger::info("automation", format!("run={} cancel requested", run_id));
    Ok(())
}

// ─── AI Provider 配置命令 ────────────────────────────────────────────────────

#[tauri::command]
pub fn read_ai_provider_config(state: State<'_, AppState>) -> Result<AiProviderConfig, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.read_ai_provider_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_ai_provider_config(
    state: State<'_, AppState>,
    config: AiProviderConfig,
) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.save_ai_provider_config(config)
        .map_err(|e| e.to_string())
}

// ── Multi-model AI config commands ────────────────────────────────────────────

#[tauri::command]
pub fn list_ai_configs(
    state: State<'_, AppState>,
) -> Result<Vec<crate::services::app_preference_service::AiConfigEntry>, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.list_ai_configs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_ai_config(
    state: State<'_, AppState>,
    entry: crate::services::app_preference_service::AiConfigEntry,
) -> Result<crate::services::app_preference_service::AiConfigEntry, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.create_ai_config(entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_ai_config(
    state: State<'_, AppState>,
    entry: crate::services::app_preference_service::AiConfigEntry,
) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.update_ai_config(entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_ai_config(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.delete_ai_config(&id).map_err(|e| e.to_string())
}

// ── Chromium logging toggle ───────────────────────────────────────────────

#[tauri::command]
pub fn read_chromium_logging_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.read_chromium_logging_enabled()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_chromium_logging_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.save_chromium_logging_enabled(enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_script_canvas_positions(
    state: State<'_, AppState>,
    script_id: String,
    positions_json: String,
) -> Result<(), String> {
    state
        .lock_automation_service()
        .update_canvas_positions(&script_id, positions_json)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn update_script_variables_schema(
    state: State<'_, AppState>,
    script_id: String,
    schema_json: String,
) -> Result<(), String> {
    state
        .lock_automation_service()
        .update_variables_schema(&script_id, schema_json)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn list_active_automation_runs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let tokens = state
        .cancel_tokens
        .lock()
        .map_err(|_| "lock poisoned".to_string())?;
    Ok(tokens.keys().cloned().collect())
}

/// 导出自动化脚本到指定文件路径
#[tauri::command]
pub async fn export_automation_script_to_file(
    state: tauri::State<'_, AppState>,
    script_id: String,
    file_path: String,
) -> Result<(), String> {
    let script = {
        let svc = state
            .automation_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.get_script(&script_id).map_err(|e| e.to_string())?
    };
    let json = serde_json::to_string_pretty(&script).map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&file_path, json).map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(())
}

// ─── 执行引擎 ─────────────────────────────────────────────────────────────────

/// 步骤流控信号
#[derive(Debug)]
enum FlowSignal {
    Normal,
    Break,
    Continue,
    Error(String),
}

async fn execute_script(
    app: AppHandle,
    run_id: String,
    script_id: String,
    profile_id: String,
    debug_port: Option<u16>,
    magic_port: Option<u16>,
    steps: Vec<ScriptStep>,
    initial_vars: HashMap<String, String>,
    script_ai_config: Option<AiProviderConfig>,
    step_delay_ms: u16,
    delay_config: Option<crate::models::RunDelayConfig>,
) {
    let step_total = steps.len();
    let cdp = debug_port.map(CdpClient::new);
    let http_client = reqwest::Client::new();
    let mut results: Vec<StepResult> = Vec::with_capacity(step_total);
    let mut logs: Vec<crate::models::RunLogEntry> = Vec::new();
    logs.push(log_entry(
        "info",
        "flow",
        format!("脚本开始执行，共 {} 个步骤", step_total),
        None,
    ));
    let mut vars = RunVariables::new();
    vars.set("__script_id__", script_id);
    vars.set("__profile_id__", profile_id);
    for (k, v) in initial_vars {
        vars.set(&k, v);
    }

    let signal = execute_steps(
        steps,
        vec![],
        step_total,
        cdp.as_ref(),
        &http_client,
        magic_port,
        &app,
        &run_id,
        &mut results,
        &mut vars,
        script_ai_config.as_ref(),
        step_delay_ms,
        delay_config.as_ref(),
        &mut logs,
    )
    .await;

    if let Ok(mut tokens) = app.state::<AppState>().cancel_tokens.lock() {
        tokens.remove(&run_id);
    }

    let final_status = match &signal {
        FlowSignal::Normal => "success",
        FlowSignal::Error(msg) if msg == "cancelled" => "cancelled",
        FlowSignal::Error(_) => "failed",
        _ => "success",
    };
    let error_msg = match &signal {
        FlowSignal::Error(msg) if msg != "cancelled" => results
            .iter()
            .find(|r| r.status == "failed")
            .and_then(|r| r.output.clone())
            .or_else(|| Some(msg.clone())),
        _ => None,
    };
    logs.push(log_entry(
        "info",
        "flow",
        format!("脚本执行完成，状态: {}", final_status),
        None,
    ));
    let vars_json = serde_json::to_string(&vars.snapshot()).ok();
    let logs_json_str = serde_json::to_string(&logs).ok();
    persist_run_progress(
        &app,
        &run_id,
        &results,
        final_status,
        error_msg.as_deref(),
        vars_json.as_deref(),
        logs_json_str.as_deref(),
    );
    match final_status {
        "success" => logger::info(
            "automation",
            format!("run={} completed status=success", run_id),
        ),
        "cancelled" => logger::info(
            "automation",
            format!("run={} completed status=cancelled", run_id),
        ),
        _ => logger::warn(
            "automation",
            format!(
                "run={} completed status=failed error={}",
                run_id,
                error_msg.as_deref().unwrap_or("unknown")
            ),
        ),
    }
    emit_progress(
        &app,
        &run_id,
        step_total.saturating_sub(1),
        step_total,
        final_status,
        None,
        0,
        final_status,
        HashMap::new(),
        vec![],
    );
}

/// 递归执行步骤列表（BoxFuture 解决 async 递归无法确定大小的问题）
#[allow(clippy::too_many_arguments)]
fn execute_steps<'a>(
    steps: Vec<ScriptStep>,
    path_prefix: Vec<usize>,
    step_total: usize,
    cdp: Option<&'a CdpClient>,
    http_client: &'a reqwest::Client,
    magic_port: Option<u16>,
    app: &'a AppHandle,
    run_id: &'a str,
    results: &'a mut Vec<StepResult>,
    vars: &'a mut RunVariables,
    script_ai_config: Option<&'a AiProviderConfig>,
    step_delay_ms: u16,
    delay_config: Option<&'a crate::models::RunDelayConfig>,
    logs: &'a mut Vec<crate::models::RunLogEntry>,
) -> BoxFuture<'a, FlowSignal> {
    Box::pin(async move {
        for (index, step) in steps.into_iter().enumerate() {
            if is_cancelled(app, run_id) {
                return FlowSignal::Error("cancelled".to_string());
            }

            let mut step_path = path_prefix.clone();
            step_path.push(index);
            let top_index = path_prefix.first().copied().unwrap_or(index);

            emit_progress(
                app,
                run_id,
                top_index,
                step_total,
                "running",
                None,
                0,
                "running",
                HashMap::new(),
                step_path.clone(),
            );

            let start = Instant::now();
            let kind_str = serde_json::to_value(&step)
                .ok()
                .and_then(|v| v.get("kind").and_then(|k| k.as_str().map(String::from)))
                .unwrap_or_else(|| "unknown".to_string());
            logger::info(
                "automation",
                format!(
                    "run={} step={} kind={} started",
                    run_id, top_index, kind_str
                ),
            );
            logs.push(log_entry(
                "info",
                "step",
                format!("步骤 {} [{}] 开始执行", top_index, kind_str),
                serde_json::to_value(&step).ok(),
            ));

            match &step {
                ScriptStep::Break => return FlowSignal::Break,
                ScriptStep::Continue => return FlowSignal::Continue,

                ScriptStep::Condition {
                    condition_expr,
                    then_steps,
                    else_steps,
                } => {
                    let expr = vars.interpolate(condition_expr);
                    let is_true = vars.eval_condition(&expr);
                    logs.push(log_entry(
                        "info",
                        "flow",
                        format!("条件判断: expr={}, result={}", expr, is_true),
                        None,
                    ));
                    let branch = if is_true {
                        then_steps.clone()
                    } else {
                        else_steps.clone()
                    };
                    let signal = execute_steps(
                        branch,
                        step_path.clone(),
                        step_total,
                        cdp,
                        http_client,
                        magic_port,
                        app,
                        run_id,
                        results,
                        vars,
                        script_ai_config,
                        step_delay_ms,
                        delay_config,
                        logs,
                    )
                    .await;
                    match signal {
                        FlowSignal::Normal | FlowSignal::Continue => {}
                        FlowSignal::Break | FlowSignal::Error(_) => return signal,
                    }
                    let dur = start.elapsed().as_millis() as u64;
                    let cond_output = Some(format!(
                        "condition={expr}, branch={}",
                        if is_true { "then" } else { "else" }
                    ));
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: cond_output.clone(),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    emit_progress(
                        app,
                        run_id,
                        top_index,
                        step_total,
                        "success",
                        cond_output,
                        dur,
                        "running",
                        HashMap::new(),
                        step_path.clone(),
                    );
                    continue;
                }

                ScriptStep::Loop {
                    mode,
                    count,
                    condition_expr,
                    max_iterations,
                    iter_var,
                    body_steps,
                } => {
                    let max = max_iterations.unwrap_or(u64::MAX);
                    let mut iteration: u64 = 0;
                    logs.push(log_entry(
                        "info",
                        "flow",
                        format!("循环步骤 {} 开始", top_index),
                        None,
                    ));
                    loop {
                        if iteration >= max {
                            break;
                        }
                        let should_run = match mode {
                            LoopMode::Count => iteration < count.unwrap_or(1),
                            LoopMode::While => condition_expr
                                .as_ref()
                                .map(|e| vars.eval_condition(&vars.interpolate(e)))
                                .unwrap_or(false),
                        };
                        if !should_run {
                            break;
                        }
                        if let Some(key) = iter_var {
                            vars.set(key, iteration.to_string());
                        }
                        let mut iter_path = step_path.clone();
                        iter_path.push(iteration as usize);
                        let signal = execute_steps(
                            body_steps.clone(),
                            iter_path,
                            step_total,
                            cdp,
                            http_client,
                            magic_port,
                            app,
                            run_id,
                            results,
                            vars,
                            script_ai_config,
                            step_delay_ms,
                            delay_config,
                            logs,
                        )
                        .await;
                        match signal {
                            FlowSignal::Break => break,
                            FlowSignal::Error(e) => return FlowSignal::Error(e),
                            _ => {}
                        }
                        iteration += 1;
                    }
                    logs.push(log_entry(
                        "info",
                        "flow",
                        format!("循环步骤 {} 结束，迭代 {} 次", top_index, iteration),
                        None,
                    ));
                    let dur = start.elapsed().as_millis() as u64;
                    let loop_output = Some(format!("iterations={iteration}"));
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: loop_output.clone(),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    emit_progress(
                        app,
                        run_id,
                        top_index,
                        step_total,
                        "success",
                        loop_output,
                        dur,
                        "running",
                        HashMap::new(),
                        step_path.clone(),
                    );
                    continue;
                }

                _ => {} // 普通步骤走通用路径
            }

            // 普通步骤
            let result = execute_step(
                cdp,
                http_client,
                magic_port,
                &step,
                vars,
                app,
                run_id,
                top_index,
                script_ai_config,
                logs,
            )
            .await;
            if let Err(e) = &result {
                logger::warn(
                    "automation",
                    format!("run={} step={} failed: {}", run_id, top_index, e),
                );
            }
            let dur = start.elapsed().as_millis() as u64;

            if is_cancelled(app, run_id) {
                return FlowSignal::Error("cancelled".to_string());
            }

            match result {
                Ok((output, vars_set)) => {
                    for (k, v) in &vars_set {
                        vars.set(k, v.clone());
                    }
                    if !vars_set.is_empty() {
                        emit_variables_updated(app, run_id, vars.snapshot());
                    }
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: output.clone(),
                        duration_ms: dur,
                        vars_set: vars_set.clone(),
                    });
                    logs.push(log_entry(
                        "info",
                        "step",
                        format!("步骤 {} 成功 ({}ms)", top_index, dur),
                        Some(json!({
                            "output": output.clone(),
                            "varsSet": vars_set.clone(),
                        })),
                    ));
                    emit_progress(
                        app, run_id, top_index, step_total, "success", output, dur, "running",
                        vars_set, step_path,
                    );
                    logger::info(
                        "automation",
                        format!(
                            "run={} step={} succeeded duration_ms={}",
                            run_id, top_index, dur
                        ),
                    );
                    if path_prefix.is_empty() {
                        let logs_snapshot = serde_json::to_string(&*logs).ok();
                        persist_run_progress(
                            app,
                            run_id,
                            results,
                            "running",
                            None,
                            None,
                            logs_snapshot.as_deref(),
                        );
                    }
                    if step_delay_ms > 0 {
                        tokio::time::sleep(Duration::from_millis(step_delay_ms as u64)).await;
                    }
                    if let Some(dc) = delay_config {
                        if dc.enabled && dc.max_seconds > 0.0 {
                            use rand::Rng;
                            let min = dc.min_seconds.max(0.0);
                            let max = dc.max_seconds.max(min);
                            let delay_secs = rand::thread_rng().gen_range(min..=max);
                            tokio::time::sleep(Duration::from_secs_f64(delay_secs)).await;
                        }
                    }
                }
                Err(err) => {
                    logs.push(log_entry(
                        "error",
                        "step",
                        format!("步骤 {} 失败: {}", top_index, err),
                        Some(json!({ "error": err.clone() })),
                    ));
                    results.push(StepResult {
                        index: top_index,
                        status: "failed".to_string(),
                        output: Some(err.clone()),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    emit_progress(
                        app,
                        run_id,
                        top_index,
                        step_total,
                        "failed",
                        Some(err.clone()),
                        dur,
                        "running",
                        HashMap::new(),
                        step_path,
                    );
                    let logs_snapshot = serde_json::to_string(&*logs).ok();
                    persist_run_progress(
                        app,
                        run_id,
                        results,
                        "running",
                        None,
                        None,
                        logs_snapshot.as_deref(),
                    );

                    // 暂停询问用户是否继续
                    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
                    {
                        let app_state = app.state::<AppState>();
                        let mut guard = app_state
                            .active_run_channels
                            .lock()
                            .unwrap_or_else(|e| e.into_inner());
                        guard.insert(run_id.to_string(), tx);
                    }
                    let _ = app.emit(
                        "automation_step_error_pause",
                        AutomationStepErrorPauseEvent {
                            run_id: run_id.to_string(),
                            step_index: top_index,
                            error_message: err.clone(),
                        },
                    );
                    match rx.await {
                        Ok(Some(ref s)) if s == "continue" => {
                            // 用户选择继续，跳过此步骤，继续下一步
                            continue;
                        }
                        _ => {
                            // 用户选择停止或已取消
                            return FlowSignal::Error(err);
                        }
                    }
                }
            }
        }
        FlowSignal::Normal
    })
}

/// 执行单个普通步骤
#[allow(clippy::too_many_arguments)]
async fn execute_step(
    cdp: Option<&CdpClient>,
    http_client: &reqwest::Client,
    magic_port: Option<u16>,
    step: &ScriptStep,
    vars: &RunVariables,
    app: &AppHandle,
    run_id: &str,
    step_index: usize,
    script_ai_config: Option<&AiProviderConfig>,
    logs: &mut Vec<crate::models::RunLogEntry>,
) -> Result<(Option<String>, HashMap<String, String>), String> {
    let get_magic_port = || {
        magic_port.ok_or_else(|| "Magic Controller not available (profile not running)".to_string())
    };
    match step {
        ScriptStep::Navigate { url, output_key } => {
            let url = vars.interpolate(url);
            let cdp = cdp.ok_or_else(|| "CDP not available (profile not running)".to_string())?;
            cdp.call("Page.navigate", json!({ "url": url })).await?;
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), url.clone());
            }
            Ok((Some(url), vs))
        }
        ScriptStep::Wait { ms } => {
            tokio::time::sleep(Duration::from_millis(*ms)).await;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Evaluate {
            expression,
            result_key,
        } => {
            let expression = vars.interpolate(expression);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expression, "returnByValue": true }),
                )
                .await?;
            let value = result
                .get("result")
                .and_then(|r| r.get("value"))
                .map(|v| v.to_string());
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (result_key, &value) {
                vs.insert(k.clone(), v.clone());
            }
            Ok((value, vs))
        }
        ScriptStep::Click {
            selector,
            selector_type,
        } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            click_element(cdp, &selector, selector_type).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Type {
            selector: _,
            text,
            selector_type: _,
        } => {
            let text = vars.interpolate(text);
            let port = get_magic_port()?;
            http_client
                .post(format!("http://127.0.0.1:{port}/"))
                .json(&json!({ "cmd": "type_string", "text": text }))
                .send()
                .await
                .map_err(|e| format!("Magic request failed: {e}"))?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Screenshot { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call("Page.captureScreenshot", json!({ "format": "png" }))
                .await?;
            let b64 = result
                .get("data")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Screenshot: no data in CDP response".to_string())?
                .to_string();
            let bytes = base64_decode(&b64)?;
            let data_dir = app
                .path()
                .app_local_data_dir()
                .or_else(|_| app.path().app_data_dir())
                .map_err(|e| format!("Screenshot: resolve data dir: {e}"))?;
            let screenshots_dir = data_dir.join("screenshots");
            std::fs::create_dir_all(&screenshots_dir)
                .map_err(|e| format!("Screenshot: create dir: {e}"))?;
            let filename = format!("screenshot_{}_{}.png", run_id, step_index);
            let file_path = screenshots_dir.join(&filename);
            std::fs::write(&file_path, bytes)
                .map_err(|e| format!("Screenshot: write file: {e}"))?;
            let path_str = file_path.to_string_lossy().to_string();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), path_str.clone());
            }
            Ok((Some(path_str), vs))
        }
        ScriptStep::Magic {
            command,
            params,
            output_key,
        } => {
            let command = vars.interpolate(command);
            let params = vars.interpolate_value(params);
            let port = get_magic_port()?;
            let mut payload = params.clone();
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("cmd".to_string(), json!(command));
            }
            let resp = http_client
                .post(format!("http://127.0.0.1:{port}/"))
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Magic request failed: {e}"))?;
            let body = resp
                .text()
                .await
                .map_err(|e| format!("Magic read body failed: {e}"))?;
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), body.clone());
            }
            Ok((Some(body), vs))
        }
        ScriptStep::Cdp {
            method,
            params,
            output_key,
        } => {
            let method = vars.interpolate(method);
            let params = params
                .as_ref()
                .map(|p| vars.interpolate_value(p))
                .unwrap_or(json!({}));
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call(&method, params).await?;
            let output = Some(result.to_string());
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &output) {
                vs.insert(k.clone(), v.clone());
            }
            Ok((output, vs))
        }
        ScriptStep::WaitForUser {
            message,
            input_label,
            output_key,
            timeout_ms,
            on_timeout,
        } => {
            let message = vars.interpolate(message);
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                let mut guard = app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                guard.insert(run_id.to_string(), tx);
            }
            let _ = app.emit(
                "automation_human_required",
                AutomationHumanRequiredEvent {
                    run_id: run_id.to_string(),
                    message: message.clone(),
                    input_label: input_label.clone(),
                    timeout_ms: *timeout_ms,
                    step_path: vec![step_index],
                },
            );
            let user_input = if let Some(ms) = timeout_ms {
                match tokio::time::timeout(Duration::from_millis(*ms), rx).await {
                    Ok(Ok(input)) => input,
                    Ok(Err(_)) => None,
                    Err(_) => {
                        {
                            let app_state = app.state::<AppState>();
                            app_state
                                .active_run_channels
                                .lock()
                                .unwrap_or_else(|e| e.into_inner())
                                .remove(run_id);
                        }
                        match on_timeout {
                            WaitForUserTimeout::Continue => Some(String::new()),
                            WaitForUserTimeout::Fail => {
                                emit_human_dismissed(app, run_id);
                                return Err(format!("WaitForUser timed out after {ms}ms"));
                            }
                        }
                    }
                }
            } else {
                match rx.await {
                    Ok(input) => input,
                    Err(_) => None,
                }
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &user_input) {
                vs.insert(k.clone(), v.clone());
            }
            let output = user_input.map(|s| {
                if s.is_empty() {
                    "(timeout)".to_string()
                } else {
                    s
                }
            });
            Ok((output, vs))
        }
        // ── AI 步骤 ───────────────────────────────────────────────────────────
        ScriptStep::AiPrompt {
            prompt,
            image_var,
            model_override,
            output_key,
        } => {
            let prompt = vars.interpolate(prompt);
            let image_b64 = image_var.as_ref().and_then(|k| vars.get(k));
            let config = load_ai_config(app, script_ai_config, None, model_override.as_ref());
            let content = build_vision_content(&prompt, image_b64.as_deref());
            let ai = AiService::new(http_client.clone());
            logs.push(log_entry(
                "info",
                "ai",
                "AI Prompt 请求".to_string(),
                Some(json!({
                    "prompt": &prompt,
                    "model": config.model.clone(),
                })),
            ));
            let reply = ai
                .chat(
                    &config,
                    vec![ChatMessage::with_content("user", content)],
                    None,
                )
                .await?;
            logs.push(log_entry(
                "info",
                "ai",
                "AI Prompt 响应".to_string(),
                Some(json!({ "reply": &reply })),
            ));
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), reply.clone());
            }
            Ok((Some(reply), vs))
        }
        ScriptStep::AiExtract {
            prompt,
            image_var,
            output_key_map,
            model_override,
        } => {
            let prompt = vars.interpolate(prompt);
            let image_b64 = image_var.as_ref().and_then(|k| vars.get(k));
            let config = load_ai_config(app, script_ai_config, None, model_override.as_ref());
            let content = build_vision_content(&prompt, image_b64.as_deref());
            let response_format = serde_json::json!({ "type": "json_object" });
            let ai = AiService::new(http_client.clone());
            logs.push(log_entry(
                "info",
                "ai",
                "AI Extract 请求".to_string(),
                Some(json!({
                    "prompt": &prompt,
                    "model": config.model.clone(),
                    "responseFormat": "json_object",
                })),
            ));
            let reply = ai
                .chat(
                    &config,
                    vec![ChatMessage::with_content("user", content)],
                    Some(response_format),
                )
                .await?;
            let mut vs = HashMap::new();
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&reply) {
                for AiOutputKeyMapping {
                    json_path,
                    var_name,
                } in output_key_map
                {
                    if let Some(v) = extract_json_path(&parsed, json_path) {
                        vs.insert(var_name.clone(), v);
                    }
                }
            }
            logs.push(log_entry(
                "info",
                "ai",
                "AI Extract 响应".to_string(),
                Some(json!({
                    "reply": &reply,
                    "varsSet": &vs,
                })),
            ));
            Ok((Some(reply), vs))
        }
        ScriptStep::AiAgent {
            system_prompt,
            initial_message,
            max_steps,
            output_key,
        } => {
            let system_prompt = vars.interpolate(system_prompt);
            let initial_message = vars.interpolate(initial_message);
            let config = load_ai_config(app, script_ai_config, None, None);
            let tools = build_agent_tools();
            let ai = AiService::new(http_client.clone());

            let mut messages: Vec<ChatMessage> = vec![
                ChatMessage::system(&system_prompt),
                ChatMessage::user(&initial_message),
            ];

            let mut final_text = String::new();
            let mut agent_vars: HashMap<String, String> = HashMap::new();

            for round in 0..*max_steps {
                logs.push(log_entry(
                    "debug",
                    "ai",
                    format!("AI Agent 第 {} 轮请求", round + 1),
                    Some(json!({ "messagesCount": messages.len() })),
                ));
                match ai.chat_with_tools(&config, &messages, &tools).await? {
                    AiChatResult::Text(text) => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            "AI Agent 返回最终文本".to_string(),
                            Some(json!({ "text": &text })),
                        ));
                        final_text = text;
                        break;
                    }
                    AiChatResult::ToolCalls(calls) => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            format!("AI Agent 返回 {} 个工具调用", calls.len()),
                            Some(json!({
                                "tools": calls.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
                            })),
                        ));
                        // 构建带 tool_calls 字段的 assistant 消息追加到历史
                        let raw_tool_calls: Vec<serde_json::Value> =
                            calls.iter().map(|c| c.raw.clone()).collect();
                        messages.push(ChatMessage {
                            role: "assistant".into(),
                            content: crate::services::ai_service::ChatContent::Text(String::new()),
                            tool_calls: Some(raw_tool_calls),
                            tool_call_id: None,
                            name: None,
                        });

                        for tool_call in &calls {
                            // 将 kind 字段注入 arguments，构造完整的 ScriptStep JSON
                            let mut step_json = tool_call.arguments.clone();
                            if let Some(obj) = step_json.as_object_mut() {
                                obj.insert(
                                    "kind".to_string(),
                                    serde_json::Value::String(tool_call.name.clone()),
                                );
                            }

                            let tool_result = match serde_json::from_value::<ScriptStep>(step_json)
                            {
                                Err(e) => format!("step parse error: {e}"),
                                Ok(inner_step) => {
                                    // 使用 Box::pin 避免无限递归的 Future 大小问题
                                    let merged_vars = {
                                        let mut v = vars.clone();
                                        for (k, val) in &agent_vars {
                                            v.set(k, val.clone());
                                        }
                                        v
                                    };
                                    match Box::pin(execute_step(
                                        cdp,
                                        http_client,
                                        magic_port,
                                        &inner_step,
                                        &merged_vars,
                                        app,
                                        run_id,
                                        step_index,
                                        script_ai_config,
                                        logs,
                                    ))
                                    .await
                                    {
                                        Ok((output, step_vars)) => {
                                            for (k, v) in step_vars {
                                                agent_vars.insert(k, v);
                                            }
                                            output.unwrap_or_else(|| "ok".to_string())
                                        }
                                        Err(e) => format!("step error: {e}"),
                                    }
                                }
                            };
                            logs.push(log_entry(
                                "debug",
                                "ai",
                                format!("工具 {} 执行结果", tool_call.name),
                                Some(json!({ "result": &tool_result })),
                            ));

                            messages.push(ChatMessage::tool_result(&tool_call.id, tool_result));
                        }
                    }
                }
            }

            let mut vs = agent_vars;
            if let Some(k) = output_key {
                vs.insert(k.clone(), final_text.clone());
            }
            Ok((Some(final_text), vs))
        }

        // ── CDP 具名步骤 ──────────────────────────────────────────────────────
        ScriptStep::CdpNavigate { url, output_key } => {
            let url = vars.interpolate(url);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call("Page.navigate", json!({ "url": url })).await?;
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), url.clone());
            }
            Ok((Some(url), vs))
        }
        ScriptStep::CdpReload { ignore_cache } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call("Page.reload", json!({ "ignoreCache": ignore_cache }))
                .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpEvaluate {
            expression,
            output_key,
        } => {
            let expression = vars.interpolate(expression);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expression, "returnByValue": true }),
                )
                .await?;
            let value = result
                .get("result")
                .and_then(|r| r.get("value"))
                .map(|v| v.to_string());
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &value) {
                vs.insert(k.clone(), v.clone());
            }
            Ok((value, vs))
        }
        ScriptStep::CdpClick {
            selector,
            selector_type,
        } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            click_element(cdp, &selector, selector_type).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpType {
            selector,
            text,
            selector_type,
        } => {
            let selector = vars.interpolate(selector);
            let text = vars.interpolate(text);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let node_id = find_element(cdp, &selector, selector_type).await?;
            cdp.call("DOM.focus", json!({ "nodeId": node_id })).await?;
            for ch in text.chars() {
                cdp.call(
                    "Input.dispatchKeyEvent",
                    json!({ "type": "char", "text": ch.to_string() }),
                )
                .await?;
            }
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpScrollTo {
            selector,
            selector_type,
            x,
            y,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            if let Some(sel) = selector {
                let sel = vars.interpolate(sel);
                let node_id = find_element(cdp, &sel, selector_type).await?;
                cdp.call("DOM.scrollIntoViewIfNeeded", json!({ "nodeId": node_id }))
                    .await?;
            } else {
                let sx = x.unwrap_or(0);
                let sy = y.unwrap_or(0);
                cdp.call("Runtime.evaluate",
                    json!({ "expression": format!("window.scrollTo({sx},{sy})"), "returnByValue": true })).await?;
            }
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpWaitForSelector {
            selector,
            selector_type,
            timeout_ms,
        } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let timeout = timeout_ms.unwrap_or(10_000);
            let deadline = Instant::now() + Duration::from_millis(timeout);
            loop {
                // 先用 DOM API 查找
                if find_element(cdp, &selector, selector_type).await.is_ok() {
                    break;
                }
                // DOM API 失败时，CSS 选择器回退到 JS 查找
                if *selector_type == SelectorType::Css {
                    let js = format!(
                        "!!document.querySelector({})",
                        serde_json::to_string(&selector).unwrap_or_default()
                    );
                    if let Ok(result) = cdp
                        .call(
                            "Runtime.evaluate",
                            json!({
                                "expression": js,
                                "returnByValue": true,
                            }),
                        )
                        .await
                    {
                        if result
                            .get("result")
                            .and_then(|r| r.get("value"))
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false)
                        {
                            break;
                        }
                    }
                }
                // DOM API 失败时，XPath/Text 选择器回退到 JS 查找
                if *selector_type == SelectorType::Xpath || *selector_type == SelectorType::Text {
                    let xpath = if *selector_type == SelectorType::Text {
                        format!(
                            "//*[contains(text(), {})]",
                            serde_json::to_string(&selector).unwrap_or_default()
                        )
                    } else {
                        selector.clone()
                    };
                    let xpath_json = serde_json::to_string(&xpath).unwrap_or_default();
                    let js = format!(
                        "(function(){{try{{return !!document.evaluate({xpath_json},document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}}catch(e){{return false;}}}})()"
                    );
                    if let Ok(result) = cdp
                        .call(
                            "Runtime.evaluate",
                            json!({
                                "expression": js,
                                "returnByValue": true,
                            }),
                        )
                        .await
                    {
                        if result
                            .get("result")
                            .and_then(|r| r.get("value"))
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false)
                        {
                            break;
                        }
                    }
                }
                if Instant::now() >= deadline {
                    return Err(format!("WaitForSelector timeout: {selector}"));
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
            // 找到元素后稍等，确保后续 DOM API 也能访问到该元素
            tokio::time::sleep(Duration::from_millis(50)).await;
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpWaitForPageLoad { timeout_ms } => {
            let cdp = cdp.ok_or_else(|| {
                "CDP not available (profile not running or no debug port)".to_string()
            })?;
            let timeout = timeout_ms.unwrap_or(30_000);
            let deadline = Instant::now() + Duration::from_millis(timeout);
            loop {
                let result = cdp
                    .call(
                        "Runtime.evaluate",
                        serde_json::json!({
                            "expression": "document.readyState",
                            "returnByValue": true
                        }),
                    )
                    .await;
                if let Ok(val) = result {
                    let state = val
                        .get("result")
                        .and_then(|r| r.get("value"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if state == "complete" {
                        break;
                    }
                }
                if Instant::now() >= deadline {
                    return Err(format!(
                        "CdpWaitForPageLoad: timeout after {timeout}ms, readyState not complete"
                    ));
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpGetText {
            selector,
            selector_type,
            output_key,
        } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let node_id = find_element(cdp, &selector, selector_type).await?;
            let result = cdp
                .call("DOM.getOuterHTML", json!({ "nodeId": node_id }))
                .await?;
            let html = result
                .get("outerHTML")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            // 简单剥离标签
            let text = html
                .replace(|c: char| c == '<', " <")
                .split('<')
                .filter(|s| !s.starts_with('/') && !s.is_empty())
                .flat_map(|s| s.splitn(2, '>').nth(1))
                .collect::<Vec<_>>()
                .join("")
                .trim()
                .to_string();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), text.clone());
            }
            Ok((Some(text), vs))
        }
        ScriptStep::CdpGetAttribute {
            selector,
            selector_type,
            attribute,
            output_key,
        } => {
            let selector = vars.interpolate(selector);
            let attribute = vars.interpolate(attribute);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let node_id = find_element(cdp, &selector, selector_type).await?;
            let result = cdp
                .call("DOM.getAttributes", json!({ "nodeId": node_id }))
                .await?;
            let attrs = result
                .get("attributes")
                .and_then(|a| a.as_array())
                .cloned()
                .unwrap_or_default();
            let value = attrs
                .chunks(2)
                .find(|pair| pair[0].as_str() == Some(&attribute))
                .and_then(|pair| pair[1].as_str())
                .map(|s| s.to_string());
            let value_str = value.unwrap_or_default();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), value_str.clone());
            }
            Ok((Some(value_str), vs))
        }
        ScriptStep::CdpSetInputValue {
            selector,
            selector_type,
            value,
        } => {
            let selector = vars.interpolate(selector);
            let value = vars.interpolate(value);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let find_expr = js_find_element_expr(&selector, selector_type);
            // 通过 JS 设置 value 并触发 input/change 事件
            let expr = format!(
                r#"(function(){{
                    const el = {find_expr};
                    if (!el) throw new Error('element not found: {sel_esc}');
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
                    nativeInputValueSetter.call(el, {val_json});
                    el.dispatchEvent(new Event('input',{{bubbles:true}}));
                    el.dispatchEvent(new Event('change',{{bubbles:true}}));
                }})();"#,
                find_expr = find_expr,
                sel_esc = selector.replace('"', "\\\""),
                val_json = serde_json::to_string(&value).unwrap_or_default(),
            );
            cdp.call(
                "Runtime.evaluate",
                json!({ "expression": expr, "returnByValue": true }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::CdpScreenshot {
            format,
            quality,
            output_path,
            output_key_base64: _,
            output_key_file_path,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let fmt = format.as_deref().unwrap_or("png");
            let mut params = json!({ "format": fmt });
            if let Some(q) = quality {
                params["quality"] = json!(q);
            }
            let result = cdp.call("Page.captureScreenshot", params).await?;
            let b64 = result
                .get("data")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "CdpScreenshot: no data in CDP response".to_string())?
                .to_string();
            let bytes = base64_decode(&b64)?;

            // 确定保存路径：用户指定路径 > 自动生成默认路径
            let save_path = match output_path {
                Some(ref p) if !p.is_empty() => {
                    let p = vars.interpolate(p);
                    let path = std::path::PathBuf::from(&p);
                    if let Some(parent) = path.parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("CdpScreenshot: create dir: {e}"))?;
                    }
                    path
                }
                _ => {
                    // 默认路径：automation_data/<script_id>/<profile_id>/screenshots/
                    let data_dir = app
                        .path()
                        .app_local_data_dir()
                        .or_else(|_| app.path().app_data_dir())
                        .map_err(|e| format!("CdpScreenshot: resolve data dir: {e}"))?;
                    let sid = vars.get("__script_id__").unwrap_or("unknown");
                    let pid = vars.get("__profile_id__").unwrap_or("unknown");
                    let dir = data_dir
                        .join("automation_data")
                        .join(sid)
                        .join(pid)
                        .join("screenshots");
                    std::fs::create_dir_all(&dir)
                        .map_err(|e| format!("CdpScreenshot: create dir: {e}"))?;
                    dir.join(format!("screenshot_{}_{}.{}", run_id, step_index, fmt))
                }
            };

            std::fs::write(&save_path, bytes)
                .map_err(|e| format!("CdpScreenshot: write file: {e}"))?;
            let path_str = save_path.to_string_lossy().to_string();

            let mut vs = HashMap::new();
            // 自动缓存到 screenshot_{step_index} 变量，后续步骤可通过 {{screenshot_0}} 引用
            vs.insert(format!("screenshot_{}", step_index), path_str.clone());
            if let Some(k) = output_key_file_path {
                vs.insert(k.clone(), path_str.clone());
            }
            Ok((Some(path_str), vs))
        }

        // ── Magic 具名步骤 ─────────────────────────────────────────────────────
        ScriptStep::MagicSetBounds {
            x,
            y,
            width,
            height,
            output_key,
        } => {
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "set_bounds", "x": x, "y": y, "width": width, "height": height }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetBounds { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_bounds" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicSetMaximized => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_maximized" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetMinimized => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_minimized" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetClosed => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_closed" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetRestored => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_restored" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetFullscreen => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_fullscreen" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetBgColor { r, g, b } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "set_bg_color" });
            if let Some(v) = r {
                payload["r"] = json!(v);
            }
            if let Some(v) = g {
                payload["g"] = json!(v);
            }
            if let Some(v) = b {
                payload["b"] = json!(v);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetToolbarText { text } => {
            let text = vars.interpolate(text);
            let port = get_magic_port()?;
            magic_post(
                http_client,
                port,
                json!({ "cmd": "set_toolbar_text", "text": text }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetAppTopMost => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "set_app_top_most" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicSetMasterIndicatorVisible { visible, label } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "set_master_indicator_visible" });
            if let Some(v) = visible {
                payload["visible"] = json!(v);
            }
            if let Some(l) = label {
                payload["label"] = json!(vars.interpolate(l));
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicOpenNewTab {
            url,
            browser_id,
            output_key,
        } => {
            let url = vars.interpolate(url);
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "open_new_tab", "url": url });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicCloseTab { tab_id } => {
            let port = get_magic_port()?;
            magic_post(
                http_client,
                port,
                json!({ "cmd": "close_tab", "tab_id": tab_id }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicActivateTab { tab_id } => {
            let port = get_magic_port()?;
            magic_post(
                http_client,
                port,
                json!({ "cmd": "activate_tab", "tab_id": tab_id }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicActivateTabByIndex { index, browser_id } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "activate_tab_by_index", "index": index });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicCloseInactiveTabs => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "close_inactive_tabs" })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicOpenNewWindow { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "open_new_window" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicTypeString { text, tab_id } => {
            let text = vars.interpolate(text);
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "type_string", "text": text });
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicGetBrowsers { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_browsers" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetActiveBrowser { output_key } => {
            let port = get_magic_port()?;
            let body =
                magic_post(http_client, port, json!({ "cmd": "get_active_browser" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetTabs {
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "get_tabs", "browser_id": browser_id }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetActiveTabs { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_active_tabs" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetSwitches { key, output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "get_switches", "key": key }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetHostName { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_host_name" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetMacAddress { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_mac_address" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetBookmarks { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_bookmarks" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicCreateBookmark {
            parent_id,
            title,
            url,
            output_key,
        } => {
            let (title, url) = (vars.interpolate(title), vars.interpolate(url));
            let port = get_magic_port()?;
            let body = magic_post(http_client, port,
                json!({ "cmd": "create_bookmark", "parent_id": parent_id, "title": title, "url": url })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicCreateBookmarkFolder {
            parent_id,
            title,
            output_key,
        } => {
            let title = vars.interpolate(title);
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "create_bookmark_folder", "parent_id": parent_id, "title": title }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicUpdateBookmark {
            node_id,
            title,
            url,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "update_bookmark", "node_id": node_id });
            if let Some(t) = title {
                payload["title"] = json!(vars.interpolate(t));
            }
            if let Some(u) = url {
                payload["url"] = json!(vars.interpolate(u));
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicMoveBookmark {
            node_id,
            new_parent_id,
        } => {
            let port = get_magic_port()?;
            magic_post(http_client, port,
                json!({ "cmd": "move_bookmark", "node_id": node_id, "new_parent_id": new_parent_id })).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicRemoveBookmark { node_id } => {
            let port = get_magic_port()?;
            magic_post(
                http_client,
                port,
                json!({ "cmd": "remove_bookmark", "node_id": node_id }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicBookmarkCurrentTab {
            browser_id,
            parent_id,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "bookmark_current_tab" });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            if let Some(pid) = parent_id {
                payload["parent_id"] = json!(pid);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicUnbookmarkCurrentTab { browser_id } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "unbookmark_current_tab" });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicIsCurrentTabBookmarked {
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "is_current_tab_bookmarked" });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicExportBookmarkState {
            environment_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "export_bookmark_state" });
            if let Some(eid) = environment_id {
                payload["environment_id"] = json!(eid);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetManagedCookies { output_key } => {
            let port = get_magic_port()?;
            let body =
                magic_post(http_client, port, json!({ "cmd": "get_managed_cookies" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicExportCookieState {
            mode,
            url,
            environment_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "export_cookie_state", "mode": mode });
            if let Some(u) = url {
                payload["url"] = json!(vars.interpolate(u));
            }
            if let Some(eid) = environment_id {
                payload["environment_id"] = json!(eid);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetManagedExtensions { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "get_managed_extensions" }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicTriggerExtensionAction {
            extension_id,
            browser_id,
        } => {
            let port = get_magic_port()?;
            let mut payload =
                json!({ "cmd": "trigger_extension_action", "extension_id": extension_id });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicCloseExtensionPopup { browser_id } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "close_extension_popup" });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicToggleSyncMode {
            role,
            browser_id,
            session_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "toggle_sync_mode", "role": role });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            if let Some(sid) = session_id {
                payload["session_id"] = json!(sid);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetSyncMode { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_sync_mode" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetIsMaster { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_is_master" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetSyncStatus { output_key } => {
            let port = get_magic_port()?;
            let body = magic_post(http_client, port, json!({ "cmd": "get_sync_status" })).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicCaptureAppShell {
            browser_id,
            format,
            output_path,
            output_key_file_path,
        } => {
            let port = get_magic_port()?;
            let fmt = format.as_deref().unwrap_or("png");

            // 确定保存路径：用户指定路径 > 自动生成默认路径
            let save_path = match output_path {
                Some(ref p) if !p.is_empty() => {
                    let p = vars.interpolate(p);
                    let path = std::path::PathBuf::from(&p);
                    if let Some(parent) = path.parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("MagicCaptureAppShell: create dir: {e}"))?;
                    }
                    path
                }
                _ => {
                    let data_dir = app
                        .path()
                        .app_local_data_dir()
                        .or_else(|_| app.path().app_data_dir())
                        .map_err(|e| format!("MagicCaptureAppShell: resolve data dir: {e}"))?;
                    let sid = vars.get("__script_id__").unwrap_or("unknown");
                    let pid = vars.get("__profile_id__").unwrap_or("unknown");
                    let dir = data_dir
                        .join("automation_data")
                        .join(sid)
                        .join(pid)
                        .join("screenshots");
                    std::fs::create_dir_all(&dir)
                        .map_err(|e| format!("MagicCaptureAppShell: create dir: {e}"))?;
                    dir.join(format!("appshell_{}_{}.{}", run_id, step_index, fmt))
                }
            };
            let path_str = save_path.to_string_lossy().to_string();

            let mut payload = json!({
                "cmd": "capture_app_shell",
                "format": fmt,
                "mode": "file",
                "output_path": path_str,
            });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            magic_post(http_client, port, payload).await?;

            let mut vs = HashMap::new();
            vs.insert(format!("screenshot_{}", step_index), path_str.clone());
            if let Some(k) = output_key_file_path {
                vs.insert(k.clone(), path_str.clone());
            }
            Ok((Some(path_str), vs))
        }

        ScriptStep::Condition { .. }
        | ScriptStep::Loop { .. }
        | ScriptStep::Break
        | ScriptStep::Continue => {
            Err("control flow step executed outside execute_steps context".to_string())
        }
    }
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("base64 decode: {e}"))
}

/// 发送 Magic Controller HTTP 请求，尝试多个路径并重试
async fn magic_post(
    http_client: &reqwest::Client,
    port: u16,
    payload: serde_json::Value,
) -> Result<String, String> {
    const PATHS: [&str; 4] = ["/", "/cmd", "/command", "/magic"];
    const MAX_RETRIES: usize = 5;
    const RETRY_DELAY_MS: u64 = 200;

    let mut last_err = String::from("no attempts made");

    for attempt in 0..MAX_RETRIES {
        for path in PATHS {
            let url = format!("http://127.0.0.1:{port}{path}");
            match http_client.post(&url).json(&payload).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp
                        .text()
                        .await
                        .map_err(|e| format!("Magic read body failed: {e}"))?;
                    if status.as_u16() == 404 {
                        continue;
                    }
                    if status.is_success() {
                        return Ok(body);
                    }
                    last_err = format!("Magic HTTP {status}: {body}");
                }
                Err(e) => {
                    last_err = format!("Magic request failed: {e}");
                }
            }
        }
        if attempt + 1 < MAX_RETRIES {
            tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
        }
    }

    Err(last_err)
}

/// 若 output_key 有值则插入 vars map
fn opt_key(output_key: &Option<String>, value: String) -> HashMap<String, String> {
    let mut vs = HashMap::new();
    if let Some(k) = output_key {
        vs.insert(k.clone(), value);
    }
    vs
}

fn is_cancelled(app: &AppHandle, run_id: &str) -> bool {
    app.state::<AppState>()
        .cancel_tokens
        .lock()
        .map(|tokens| tokens.get(run_id).copied().unwrap_or(false))
        .unwrap_or(false)
}

// ─── 事件工具函数 ──────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app: &AppHandle,
    run_id: &str,
    step_index: usize,
    step_total: usize,
    step_status: &str,
    output: Option<String>,
    duration_ms: u64,
    run_status: &str,
    vars_set: HashMap<String, String>,
    step_path: Vec<usize>,
) {
    let event = AutomationProgressEvent {
        run_id: run_id.to_string(),
        step_index,
        step_total,
        step_status: step_status.to_string(),
        output,
        duration_ms,
        run_status: run_status.to_string(),
        vars_set,
        step_path,
    };
    if let Err(e) = app.emit("automation_progress", &event) {
        logger::warn("automation", format!("emit progress failed: {e}"));
    }
}

fn emit_variables_updated(app: &AppHandle, run_id: &str, vars: HashMap<String, String>) {
    let event = AutomationVariablesUpdatedEvent {
        run_id: run_id.to_string(),
        vars,
    };
    if let Err(e) = app.emit("automation_variables_updated", &event) {
        logger::warn("automation", format!("emit variables_updated failed: {e}"));
    }
}

fn emit_human_dismissed(app: &AppHandle, run_id: &str) {
    let _ = app.emit(
        "automation_human_dismissed",
        AutomationHumanDismissedEvent {
            run_id: run_id.to_string(),
        },
    );
}

fn log_entry(
    level: &str,
    category: &str,
    message: String,
    details: Option<serde_json::Value>,
) -> crate::models::RunLogEntry {
    crate::models::RunLogEntry {
        timestamp: crate::models::now_ts(),
        level: level.to_string(),
        category: category.to_string(),
        message,
        details,
    }
}

fn persist_run_progress(
    app: &AppHandle,
    run_id: &str,
    results: &[StepResult],
    status: &str,
    error: Option<&str>,
    variables_json: Option<&str>,
    logs_json: Option<&str>,
) {
    let results_json = serde_json::to_string(results).ok();
    let finished_at = if status == "running" {
        None
    } else {
        Some(crate::models::now_ts())
    };
    let state = app.state::<AppState>();
    let result = state.lock_automation_service().update_run_status(
        run_id,
        status,
        results_json.as_deref(),
        error,
        finished_at,
        variables_json,
        logs_json,
    );
    if let Err(e) = result {
        logger::warn(
            "automation",
            format!("persist run progress failed run_id={run_id}: {e}"),
        );
    }
}
