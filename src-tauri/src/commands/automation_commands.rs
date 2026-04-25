use std::collections::HashMap;
use std::time::{Duration, Instant};

use futures_util::future::BoxFuture;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::profile_commands::do_open_profile;
use crate::logger;
use crate::models::{
    AiExecutionDetail, AiOutputKeyMapping, AiToolCallDetail, AutomationHumanDismissedEvent,
    AutomationHumanRequiredEvent, AutomationNotificationEvent, AutomationProgressEvent,
    AutomationRun, AutomationRunCancelledEvent, AutomationScript, AutomationStepErrorPauseEvent,
    AutomationVariablesUpdatedEvent, ConfirmDialogTimeout, CreateAutomationScriptRequest, LoopMode,
    SaveAutomationCanvasGraphRequest, ScriptStep, SelectorType, StepResult, WaitForUserTimeout,
};
use crate::services::ai_service::{extract_json_path, AiChatResult, AiService, ChatMessage};
use crate::services::app_preference_service::AiProviderConfig;
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_context::{ActiveRunCtx, ActiveRunGuard};
use crate::services::automation_interpolation::RunVariables;
use crate::state::{resolve_app_data_dir, AppState};

fn error_to_string(err: crate::error::AppError) -> String {
    err.to_string()
}

async fn runtime_eval_string(cdp: &CdpClient, expression: &str) -> Result<String, String> {
    let resp = cdp
        .call(
            "Runtime.evaluate",
            json!({
                "expression": expression,
                "returnByValue": true,
            }),
        )
        .await?;
    let value = resp
        .get("result")
        .and_then(|r| r.get("value"))
        .ok_or_else(|| "Runtime.evaluate: no result value".to_string())?;
    if let Some(s) = value.as_str() {
        Ok(s.to_string())
    } else {
        Ok(value.to_string())
    }
}

async fn detect_captcha(
    cdp: &CdpClient,
) -> Result<crate::services::captcha_service::CaptchaDetectResult, String> {
    let raw = runtime_eval_string(
        cdp,
        crate::services::captcha_service::CaptchaService::detection_js(),
    )
    .await?;
    Ok(crate::services::captcha_service::CaptchaService::parse_detect_result(&raw))
}

async fn inspect_captcha_page(
    cdp: &CdpClient,
) -> Result<crate::services::captcha_service::CaptchaPageState, String> {
    let raw = runtime_eval_string(
        cdp,
        crate::services::captcha_service::CaptchaService::verification_js(),
    )
    .await?;
    Ok(crate::services::captcha_service::CaptchaService::parse_page_state(&raw))
}

async fn verify_captcha_resolution(
    cdp: &CdpClient,
    injection: &crate::services::captcha_service::CaptchaInjectionResult,
) -> Result<crate::services::captcha_service::CaptchaVerificationResult, String> {
    let mut last = crate::services::captcha_service::CaptchaVerificationResult::default();
    for attempt in 0..6 {
        match inspect_captcha_page(cdp).await {
            Ok(page_state) => {
                last = crate::services::captcha_service::CaptchaService::classify_verification(
                    &page_state,
                    injection,
                );
                if last.verified {
                    return Ok(last);
                }
            }
            Err(err) => {
                if attempt == 5 {
                    return Err(err);
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Ok(last)
}

fn normalize_detected_captcha_type(
    detected_type: &str,
) -> Result<crate::services::captcha_service::CaptchaType, String> {
    match detected_type {
        "recaptcha_v2" | "recaptcha" => {
            Ok(crate::services::captcha_service::CaptchaType::RecaptchaV2)
        }
        "recaptcha_v2_invisible" => {
            Ok(crate::services::captcha_service::CaptchaType::RecaptchaV2Invisible)
        }
        "recaptcha_v3" => Ok(crate::services::captcha_service::CaptchaType::RecaptchaV3),
        "recaptcha_enterprise" => {
            Ok(crate::services::captcha_service::CaptchaType::RecaptchaEnterprise)
        }
        "hcaptcha" => Ok(crate::services::captcha_service::CaptchaType::HCaptcha),
        "turnstile" => Ok(crate::services::captcha_service::CaptchaType::CloudflareTurnstile),
        "geetest" => Ok(crate::services::captcha_service::CaptchaType::GeeTest),
        "funcaptcha" => Ok(crate::services::captcha_service::CaptchaType::FunCaptcha),
        "image" => Ok(crate::services::captcha_service::CaptchaType::ImageToText),
        _ => Err(format!("不支持的 CAPTCHA 类型: {detected_type}")),
    }
}

fn inject_type_for_captcha(detected_type: &str) -> &str {
    match detected_type {
        t if t.starts_with("recaptcha") => "recaptcha",
        "hcaptcha" => "hcaptcha",
        "turnstile" => "turnstile",
        _ => detected_type,
    }
}

fn captcha_verification_diagnostics(
    detect: Option<&crate::services::captcha_service::CaptchaDetectResult>,
    injection: Option<&crate::services::captcha_service::CaptchaInjectionResult>,
    verification: &crate::services::captcha_service::CaptchaVerificationResult,
    browser_user_agent: Option<&str>,
    solver_user_agent: Option<&str>,
) -> String {
    serde_json::to_string(&json!({
        "captchaType": detect.and_then(|d| d.captcha_type.clone()),
        "sitekey": detect.and_then(|d| d.sitekey.clone()),
        "callback": detect.and_then(|d| d.callback.clone()),
        "pageAction": detect.and_then(|d| d.page_action.clone()),
        "gt": detect.and_then(|d| d.gt.clone()),
        "challenge": detect.and_then(|d| d.challenge.clone()),
        "publicKey": detect.and_then(|d| d.public_key.clone()),
        "browserUserAgent": browser_user_agent,
        "solverUserAgent": solver_user_agent,
        "userAgentMismatch": crate::services::captcha_service::CaptchaService::is_user_agent_mismatch(
            browser_user_agent,
            solver_user_agent,
        ),
        "injection": injection,
        "verification": verification,
    }))
    .unwrap_or_else(|_| "{\"error\":\"failed_to_serialize_captcha_diagnostics\"}".to_string())
}

fn captcha_cookie_header_from_cdp_response(value: &serde_json::Value) -> Option<String> {
    let cookies = value.get("cookies")?.as_array()?;
    let header = cookies
        .iter()
        .filter_map(|cookie| {
            let name = cookie.get("name")?.as_str()?.trim();
            if name.is_empty() {
                return None;
            }
            let value = cookie.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Some(format!("{name}={value}"))
        })
        .collect::<Vec<_>>()
        .join("; ");
    if header.is_empty() {
        None
    } else {
        Some(header)
    }
}

async fn collect_captcha_cookie_header(cdp: &CdpClient, website_url: &str) -> Option<String> {
    let result = cdp
        .call(
            "Network.getCookies",
            json!({
                "urls": [website_url],
            }),
        )
        .await
        .ok()?;
    captcha_cookie_header_from_cdp_response(&result)
}

fn captcha_proxy_config_from_proxy(
    proxy: &crate::models::Proxy,
) -> Option<crate::services::captcha_service::CaptchaProxyConfig> {
    let proxy_type = match proxy.protocol.as_str() {
        "http" | "https" | "socks5" => proxy.protocol.clone(),
        _ => return None,
    };
    if proxy.host.trim().is_empty() || !(1..=65535).contains(&proxy.port) {
        return None;
    }
    Some(crate::services::captcha_service::CaptchaProxyConfig {
        proxy_type,
        proxy_address: proxy.host.clone(),
        proxy_port: proxy.port,
        proxy_login: proxy
            .username
            .clone()
            .filter(|value| !value.trim().is_empty()),
        proxy_password: proxy.password.clone(),
    })
}

fn resolve_captcha_proxy_config(
    app: &AppHandle,
    vars: &RunVariables,
) -> Option<crate::services::captcha_service::CaptchaProxyConfig> {
    let profile_id = vars.get("__profile_id__")?;
    let state = app.state::<AppState>();
    let proxy = state
        .lock_proxy_service()
        .get_profile_proxy(profile_id)
        .ok()
        .flatten()?;
    captcha_proxy_config_from_proxy(&proxy)
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

/// XPath 查找元素：通过 Runtime.evaluate + JS XPath，无需 DOM.enable
async fn find_element_by_xpath(cdp: &CdpClient, xpath: &str) -> Result<i64, String> {
    // 用 JS XPath 查找元素是否存在，返回一个伪 nodeId（1 表示找到）
    // 对于后续操作，调用者应使用 js_find_element_expr 生成 JS 而非直接用 nodeId
    let xpath_json = serde_json::to_string(xpath).unwrap_or_default();
    let expr = format!(
        "(function(){{ \
            var r = document.evaluate({xpath_json}, document, null, \
                XPathResult.FIRST_ORDERED_NODE_TYPE, null); \
            return r.singleNodeValue != null; \
        }})()"
    );
    let result = cdp
        .call(
            "Runtime.evaluate",
            json!({ "expression": expr, "returnByValue": true }),
        )
        .await?;
    let found = result
        .get("result")
        .and_then(|r| r.get("value"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !found {
        return Err(format!("element not found (xpath): {xpath}"));
    }
    // 返回伪 nodeId=1，调用者仅用于 exists 检查或需通过 js_find_element_expr 操作元素
    Ok(1)
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

/// 通过 Runtime.evaluate + JS 聚焦元素（无需 DOM.enable，跨 session 安全）
async fn focus_element_js(
    cdp: &CdpClient,
    selector: &str,
    selector_type: &SelectorType,
) -> Result<(), String> {
    let js_expr = js_find_element_expr(selector, selector_type);
    let sel_esc = selector.replace('"', "\\\"");
    let expr = format!(
        r#"(function(){{
            var el = {js_expr};
            if (!el) throw new Error('element not found: "{sel_esc}"');
            el.focus();
            return true;
        }})()"#
    );
    let result = cdp
        .call(
            "Runtime.evaluate",
            json!({ "expression": expr, "returnByValue": true }),
        )
        .await
        .map_err(|e| format!("focus element failed: {e}"))?;
    // 检查是否有异常
    if let Some(exc) = result.get("exceptionDetails") {
        let msg = exc
            .get("exception")
            .and_then(|e| e.get("description"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        return Err(format!("focus element failed: {msg}"));
    }
    Ok(())
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

/// 将 CDP key name 映射为 Input.dispatchKeyEvent 所需的完整参数
/// 返回 (windowsVirtualKeyCode, code, text)
/// windowsVirtualKeyCode 为 0 表示未知键，调用方应按需忽略
fn cdp_key_info(key: &str) -> (i32, String, Option<String>) {
    match key {
        "Enter" => (13, "Enter".into(), Some("\r".into())),
        "Tab" => (9, "Tab".into(), None),
        "Escape" => (27, "Escape".into(), None),
        "Backspace" => (8, "Backspace".into(), None),
        "Delete" => (46, "Delete".into(), None),
        " " | "Space" => (32, "Space".into(), Some(" ".into())),
        "ArrowUp" => (38, "ArrowUp".into(), None),
        "ArrowDown" => (40, "ArrowDown".into(), None),
        "ArrowLeft" => (37, "ArrowLeft".into(), None),
        "ArrowRight" => (39, "ArrowRight".into(), None),
        "Home" => (36, "Home".into(), None),
        "End" => (35, "End".into(), None),
        "PageUp" => (33, "PageUp".into(), None),
        "PageDown" => (34, "PageDown".into(), None),
        // 单字符字母 / 数字
        s if s.len() == 1 => {
            let c = s.chars().next().unwrap();
            if c.is_ascii_alphabetic() {
                let vk = c.to_ascii_uppercase() as i32;
                let code = format!("Key{}", c.to_ascii_uppercase());
                (vk, code, Some(s.to_string()))
            } else if c.is_ascii_digit() {
                let vk = c as i32;
                let code = format!("Digit{}", c);
                (vk, code, Some(s.to_string()))
            } else {
                (0, String::new(), Some(s.to_string()))
            }
        }
        _ => (0, String::new(), None),
    }
}

/// macOS 上根据修饰键+主键组合返回浏览器编辑命令
/// Chromium 在 macOS 需要显式 commands 才能触发快捷键
#[cfg(target_os = "macos")]
fn cdp_shortcut_commands(modifiers: &[String], key: &str) -> Option<Vec<String>> {
    let has_meta = modifiers.iter().any(|m| m == "meta");
    let has_shift = modifiers.iter().any(|m| m == "shift");
    let has_ctrl = modifiers.iter().any(|m| m == "ctrl");
    let has_alt = modifiers.iter().any(|m| m == "alt");
    let k = key.to_lowercase();
    // Meta (Cmd) 系列快捷键
    if has_meta && !has_ctrl && !has_alt {
        if has_shift {
            return match k.as_str() {
                "z" => Some(vec!["redo".into()]),
                _ => None,
            };
        }
        return match k.as_str() {
            "a" => Some(vec!["selectAll".into()]),
            "c" => Some(vec!["copy".into()]),
            "v" => Some(vec!["paste".into()]),
            "x" => Some(vec!["cut".into()]),
            "z" => Some(vec!["undo".into()]),
            _ => None,
        };
    }
    None
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
                locale: entry.locale,
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
        if script_cfg.locale.is_some() {
            config.locale = script_cfg.locale.clone();
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
                locale: entry.locale,
            });
        }
    }
    legacy_config
}

// ─── Tauri 命令 ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_automation_scripts(app: AppHandle) -> Result<Vec<AutomationScript>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let result = state
            .lock_automation_service()
            .list_scripts()
            .map_err(error_to_string);
        result
    })
    .await
    .map_err(|err| format!("list automation scripts task join failed: {err}"))?
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
pub fn save_automation_canvas_graph(
    state: State<'_, AppState>,
    script_id: String,
    payload: SaveAutomationCanvasGraphRequest,
) -> Result<AutomationScript, String> {
    state
        .lock_automation_service()
        .save_canvas_graph(&script_id, payload)
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
pub async fn list_automation_runs(
    app: AppHandle,
    script_id: String,
) -> Result<Vec<AutomationRun>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let result = state
            .lock_automation_service()
            .list_runs(&script_id)
            .map_err(error_to_string);
        result
    })
    .await
    .map_err(|err| format!("list automation runs task join failed: {err}"))?
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

/// 运行脚本的核心逻辑（供 Tauri command 和 auto_tools AI 工具共享）
pub async fn do_run_script(
    app: &AppHandle,
    state: &AppState,
    script_id: &str,
    profile_id: Option<String>,
    initial_vars: Option<HashMap<String, String>>,
    delay_config: Option<crate::models::RunDelayConfig>,
    batch_id: Option<String>,
) -> Result<String, String> {
    let (steps, steps_json, script_ai_config, associated_profile_ids, step_delay_ms) = {
        let svc = state.lock_automation_service();
        let script = svc.get_script(script_id).map_err(error_to_string)?;
        let steps_json = serde_json::to_string(&script.steps)
            .map_err(|e| format!("serialize steps failed: {e}"))?;
        let step_delay_ms = script
            .settings
            .as_ref()
            .and_then(|s| s.step_delay_ms)
            .unwrap_or(0);
        let ai_config =
            resolve_script_ai_config(app, script.ai_config_id.as_ref(), script.ai_config);
        (
            script.steps,
            steps_json,
            ai_config,
            script.associated_profile_ids,
            step_delay_ms,
        )
    };
    if steps.is_empty() {
        return Err(
            "脚本无有效步骤，无法执行。请在流程编辑器中将步骤连接到 Start 节点。".to_string(),
        );
    }
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
                // 检查 DB 是否标记为 running（可能是应用重启导致内存 session 丢失）
                let is_db_running = {
                    let ps = state.lock_profile_service();
                    ps.ensure_profile_openable(&resolved_profile_id).is_err()
                };
                if is_db_running {
                    return Err(
                        "环境已启动但应用重启后连接信息丢失，请先关闭该环境再重新运行".to_string(),
                    );
                }
                logger::info(
                    "automation",
                    format!("auto-starting profile profile_id={}", resolved_profile_id),
                );
                do_open_profile(state, Some(app), None, &resolved_profile_id, None)
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
        svc.create_run(script_id, &resolved_profile_id, &steps_json)
            .map_err(error_to_string)?
    };
    let profile_name = {
        let ps = state.lock_profile_service();
        ps.get_profile(&resolved_profile_id).ok().map(|p| p.name)
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
        app.clone(),
        run_id.clone(),
        script_id.to_string(),
        resolved_profile_id.clone(),
        profile_name,
        debug_port,
        magic_port,
        steps,
        initial_vars.unwrap_or_default(),
        script_ai_config,
        step_delay_ms,
        delay_config,
        batch_id,
    ));
    Ok(run_id)
}

#[tauri::command]
pub async fn run_automation_script(
    app: AppHandle,
    state: State<'_, AppState>,
    script_id: String,
    profile_id: Option<String>,
    initial_vars: Option<HashMap<String, String>>,
    delay_config: Option<crate::models::RunDelayConfig>,
    batch_id: Option<String>,
) -> Result<String, String> {
    do_run_script(
        &app,
        &state,
        &script_id,
        profile_id,
        initial_vars,
        delay_config,
        batch_id,
    )
    .await
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
    if steps.is_empty() {
        return Err(
            "脚本无有效步骤，无法执行。请在流程编辑器中将步骤连接到 Start 节点。".to_string(),
        );
    }
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
                    message: "调试暂停 — 步骤已执行。点击继续运行下一步。".to_string(),
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
                // 检查 DB 是否标记为 running（可能是应用重启导致内存 session 丢失）
                let is_db_running = {
                    let ps = state.lock_profile_service();
                    ps.ensure_profile_openable(&resolved_profile_id).is_err()
                };
                if is_db_running {
                    return Err(
                        "环境已启动但应用重启后连接信息丢失，请先关闭该环境再重新运行".to_string(),
                    );
                }
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
    let profile_name = {
        let ps = state.lock_profile_service();
        ps.get_profile(&resolved_profile_id).ok().map(|p| p.name)
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
        profile_name,
        debug_port,
        magic_port,
        debug_steps,
        initial_vars.unwrap_or_default(),
        script_ai_config,
        step_delay_ms,
        None,
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
    let (profile_id, profile_name, batch_id) = resolve_run_ctx(&app, &run_id);
    let _ = app.emit(
        "automation_run_cancelled",
        AutomationRunCancelledEvent {
            run_id: run_id.clone(),
            profile_id,
            profile_name,
            batch_id,
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
pub async fn list_ai_configs(
    app: AppHandle,
) -> Result<Vec<crate::services::app_preference_service::AiConfigEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.list_ai_configs().map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| format!("list ai configs task join failed: {err}"))?
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

#[tauri::command]
pub fn get_default_ai_config_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.get_default_ai_config_id().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_default_ai_config_id(
    state: State<'_, AppState>,
    config_id: Option<String>,
) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.set_default_ai_config_id(config_id)
        .map_err(|e| e.to_string())
}

// ── CAPTCHA config CRUD ───────────────────────────────────────────────

#[tauri::command]
pub async fn list_captcha_configs(
    app: AppHandle,
) -> Result<Vec<crate::services::captcha_service::CaptchaSolverConfig>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.list_captcha_configs().map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| format!("list captcha configs task join failed: {err}"))?
}

#[tauri::command]
pub async fn create_captcha_config(
    app: AppHandle,
    entry: crate::services::captcha_service::CaptchaSolverConfig,
) -> Result<crate::services::captcha_service::CaptchaSolverConfig, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.create_captcha_config(entry).map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| format!("create captcha config task join failed: {err}"))?
}

#[tauri::command]
pub async fn update_captcha_config(
    app: AppHandle,
    entry: crate::services::captcha_service::CaptchaSolverConfig,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.update_captcha_config(entry).map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| format!("update captcha config task join failed: {err}"))?
}

#[tauri::command]
pub async fn delete_captcha_config(app: AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let svc = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        svc.delete_captcha_config(&id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| format!("delete captcha config task join failed: {err}"))?
}

// ── Dev 模式 Chromium 可执行文件覆盖 ─────────────────────────────────────

#[tauri::command]
pub fn read_dev_chromium_executable(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.read_dev_chromium_executable()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_dev_chromium_executable(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<(), String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.save_dev_chromium_executable(path)
        .map_err(|e| e.to_string())
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
pub fn read_app_language(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    svc.read_app_language().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_app_language(
    app: AppHandle,
    state: State<'_, AppState>,
    locale: String,
) -> Result<String, String> {
    let svc = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let locale = svc
        .save_app_language(Some(locale))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "app language cannot be empty".to_string())?;
    crate::setup_native_menu(&app, Some(&locale)).map_err(|e| e.to_string())?;
    Ok(locale)
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

/// 前端提交 AI Dialog 响应
#[tauri::command]
pub fn submit_ai_dialog_response(
    state: State<'_, AppState>,
    response: crate::services::ai_tools::dialog_tools::AiDialogResponse,
) -> Result<(), String> {
    let mut channels = state
        .ai_dialog_channels
        .lock()
        .map_err(|_| "ai_dialog_channels lock poisoned".to_string())?;
    if let Some(sender) = channels.remove(&response.request_id) {
        let _ = sender.send(response);
        Ok(())
    } else {
        Err(format!(
            "No pending dialog for request_id: {}",
            response.request_id
        ))
    }
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
    tokio::fs::write(&file_path, json)
        .await
        .map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(())
}

// ─── 执行引擎 ─────────────────────────────────────────────────────────────────

/// 步骤流控信号
#[derive(Debug)]
enum FlowSignal {
    Normal,
    Break,
    Continue,
    End,
    Error(String),
}

async fn execute_script(
    app: AppHandle,
    run_id: String,
    script_id: String,
    profile_id: String,
    profile_name: Option<String>,
    debug_port: Option<u16>,
    magic_port: Option<u16>,
    steps: Vec<ScriptStep>,
    initial_vars: HashMap<String, String>,
    script_ai_config: Option<AiProviderConfig>,
    step_delay_ms: u16,
    delay_config: Option<crate::models::RunDelayConfig>,
    batch_id: Option<String>,
) {
    let step_total = steps.len();
    // 注册运行上下文，guard 在函数结束时自动反注册（Drop）
    let _run_guard = {
        let ctx = ActiveRunCtx::new(
            run_id.clone(),
            profile_id.clone(),
            profile_name,
            script_id.clone(),
            None,
            batch_id,
            None,
        );
        let registry = app.state::<AppState>().active_runs.clone();
        ActiveRunGuard::new(registry, ctx)
    };
    let cdp = debug_port.map(CdpClient::new);
    let http_client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let mut results: Vec<StepResult> = Vec::with_capacity(step_total);
    let mut logs: Vec<crate::models::RunLogEntry> = Vec::new();

    // 等待 Magic Controller 就绪（浏览器冷启动时需要）
    if let Some(port) = magic_port {
        let probe_url = format!("http://127.0.0.1:{port}/");
        let mut ready = false;
        for attempt in 0..30 {
            if is_cancelled(&app, &run_id) {
                break;
            }
            match http_client.get(&probe_url).send().await {
                Ok(_) => {
                    ready = true;
                    if attempt > 0 {
                        logger::info(
                            "automation",
                            format!("run={} magic controller ready after {}s", run_id, attempt),
                        );
                    }
                    break;
                }
                Err(_) => {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
        if !ready && !is_cancelled(&app, &run_id) {
            logger::warn(
                "automation",
                format!(
                    "run={} magic controller not ready after 30s, proceeding anyway",
                    run_id
                ),
            );
        }
    }

    // 执行前随机延时 1-2 秒
    {
        use rand::Rng;
        let pre_delay = rand::thread_rng().gen_range(1.0..=2.0);
        tokio::time::sleep(Duration::from_secs_f64(pre_delay)).await;
    }

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
        FlowSignal::End => "success",
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
            format!(
                "run={} completed status=success steps={}",
                run_id, step_total
            ),
        ),
        "cancelled" => logger::info(
            "automation",
            format!(
                "run={} completed status=cancelled steps={}",
                run_id, step_total
            ),
        ),
        _ => logger::warn(
            "automation",
            format!(
                "run={} completed status=failed steps={} error={}",
                run_id,
                step_total,
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
                ScriptStep::End { message } => {
                    if let Some(msg) = message {
                        let msg = vars.interpolate(msg);
                        logs.push(log_entry(
                            "info",
                            "flow",
                            format!("流程结束: {}", msg),
                            None,
                        ));
                    } else {
                        logs.push(log_entry("info", "flow", "流程结束".to_string(), None));
                    }
                    let dur = start.elapsed().as_millis() as u64;
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: Some("流程结束".to_string()),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                        step_path: step_path.clone(),
                    });
                    emit_progress(
                        app,
                        run_id,
                        top_index,
                        step_total,
                        "success",
                        Some("流程结束".to_string()),
                        dur,
                        "running",
                        HashMap::new(),
                        step_path.clone(),
                    );
                    return FlowSignal::End;
                }

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
                        FlowSignal::Break | FlowSignal::Error(_) | FlowSignal::End => {
                            return signal
                        }
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
                        step_path: step_path.clone(),
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
                            FlowSignal::End => return FlowSignal::End,
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
                        step_path: step_path.clone(),
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

                // ── 确认弹窗分支（有 button_branches 时走分支逻辑）─────────
                ScriptStep::ConfirmDialog {
                    buttons,
                    button_branches,
                    ..
                } if !button_branches.is_empty() => {
                    // 先执行弹窗获取用户选择
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
                    let dur = start.elapsed().as_millis() as u64;
                    if is_cancelled(app, run_id) {
                        return FlowSignal::Error("cancelled".to_string());
                    }
                    match result {
                        Ok((output, vars_set)) => {
                            for (k, v) in &vars_set {
                                vars.set(k, v.clone());
                            }
                            let chosen_value = output.as_deref().unwrap_or("");
                            // 找到按钮索引
                            let btn_index = buttons
                                .as_ref()
                                .and_then(|bs| bs.iter().position(|b| b.value == chosen_value))
                                .unwrap_or(0);
                            // 获取对应分支
                            let branch =
                                button_branches.get(btn_index).cloned().unwrap_or_default();
                            logs.push(log_entry(
                                "info",
                                "flow",
                                format!(
                                    "弹窗分支: value={}, branch_index={}",
                                    chosen_value, btn_index
                                ),
                                None,
                            ));
                            if !branch.is_empty() {
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
                                    FlowSignal::Break | FlowSignal::Error(_) | FlowSignal::End => {
                                        return signal
                                    }
                                }
                            }
                            results.push(StepResult {
                                index: top_index,
                                status: "success".to_string(),
                                output: Some(format!("button={}", chosen_value)),
                                duration_ms: dur,
                                vars_set,
                                step_path: step_path.clone(),
                            });
                            emit_progress(
                                app,
                                run_id,
                                top_index,
                                step_total,
                                "success",
                                Some(format!("button={}", chosen_value)),
                                dur,
                                "running",
                                HashMap::new(),
                                step_path.clone(),
                            );
                            continue;
                        }
                        Err(e) => {
                            logger::warn(
                                "automation",
                                format!("run={} step={} failed: {}", run_id, top_index, e),
                            );
                            // step error pause logic
                            results.push(StepResult {
                                index: top_index,
                                status: "failed".to_string(),
                                output: Some(e.clone()),
                                duration_ms: dur,
                                vars_set: HashMap::new(),
                                step_path: step_path.clone(),
                            });
                            return FlowSignal::Error(e);
                        }
                    }
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
                        step_path: step_path.clone(),
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
                        step_path: step_path.clone(),
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
                    let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
                    let _ = app.emit(
                        "automation_step_error_pause",
                        AutomationStepErrorPauseEvent {
                            run_id: run_id.to_string(),
                            step_index: top_index,
                            error_message: err.clone(),
                            profile_id,
                            profile_name,
                            batch_id,
                        },
                    );
                    logger::warn(
                        "automation",
                        format!(
                            "Step error pause: run={} step={} err={}",
                            run_id, top_index, err
                        ),
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
pub async fn execute_step(
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
        ScriptStep::Print { text, level } => {
            let text = vars.interpolate(text);
            let lvl = level.as_deref().unwrap_or("info");
            logs.push(log_entry(lvl, "step", format!("[Print] {}", text), None));
            Ok((Some(text), HashMap::new()))
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
        ScriptStep::Screenshot {
            save_path,
            output_key,
        } => {
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
            let file_path = if let Some(sp) = save_path {
                let interpolated = vars.interpolate(sp);
                if !interpolated.is_empty() {
                    let p = std::path::PathBuf::from(&interpolated);
                    if let Some(parent) = p.parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("Screenshot: create dir: {e}"))?;
                    }
                    p
                } else {
                    let data_dir = resolve_app_data_dir(app)
                        .map_err(|e| format!("Screenshot: resolve data dir: {e}"))?;
                    let screenshots_dir = data_dir.join("screenshots");
                    std::fs::create_dir_all(&screenshots_dir)
                        .map_err(|e| format!("Screenshot: create dir: {e}"))?;
                    screenshots_dir.join(format!("screenshot_{}_{}.png", run_id, step_index))
                }
            } else {
                let data_dir = resolve_app_data_dir(app)
                    .map_err(|e| format!("Screenshot: resolve data dir: {e}"))?;
                let screenshots_dir = data_dir.join("screenshots");
                std::fs::create_dir_all(&screenshots_dir)
                    .map_err(|e| format!("Screenshot: create dir: {e}"))?;
                screenshots_dir.join(format!("screenshot_{}_{}.png", run_id, step_index))
            };
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
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt =
                    human_event_base(app, run_id, "wait_for_user", message.clone(), step_index);
                evt.input_label = input_label.clone();
                evt.timeout_ms = *timeout_ms;
                evt
            });
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
                rx.await.unwrap_or_default()
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
        ScriptStep::AiAgent {
            prompt,
            system_prompt,
            output_format,
            output_key_map,
            max_steps,
            output_key,
            model_override,
            tool_categories: _,
        } => {
            let start_time = std::time::Instant::now();
            let user_prompt = vars.interpolate(prompt);
            let sys_prompt = system_prompt.as_ref().map(|s| vars.interpolate(s));
            let config = load_ai_config(app, script_ai_config, None, model_override.as_ref());
            let is_json = output_format == "json";
            let filter = crate::services::ai_tools::ToolFilter::all();
            let tools = crate::services::ai_tools::ToolRegistry::definitions(&filter);
            let ai = AiService::new(http_client.clone());

            // 构建初始消息
            let mut messages: Vec<ChatMessage> = Vec::new();

            // 系统提示词：基础上下文 + 用户自定义（可选）+ JSON 格式要求（可选）
            let locale = config.locale.as_deref().unwrap_or("zh");
            let effective_system_prompt = crate::services::ai_prompts::build_agent_system_prompt(
                sys_prompt.as_deref(),
                is_json,
                output_key_map,
                &[],
                locale,
            );
            messages.push(ChatMessage::system(&effective_system_prompt));

            // 自动注入当前页面截图，让 AI 了解页面状态
            let initial_screenshot = if let Some(cdp_client) = cdp {
                match cdp_client
                    .call("Page.captureScreenshot", json!({ "format": "png" }))
                    .await
                {
                    Ok(resp) => resp
                        .get("data")
                        .and_then(|d| d.as_str())
                        .map(prepare_model_screenshot_data_url),
                    Err(_) => None,
                }
            } else {
                None
            };
            let user_content = crate::services::ai_service::build_vision_content(
                &format!("当前页面截图如下。\n\n任务：{}", &user_prompt),
                initial_screenshot.as_deref(),
            );
            messages.push(ChatMessage::with_content("user", user_content));

            // 开始日志
            logs.push(log_entry(
                "info",
                "ai",
                "AI Agent 开始执行".to_string(),
                Some(json!({
                    "systemPrompt": effective_system_prompt,
                    "userPrompt": &user_prompt,
                    "outputFormat": output_format,
                    "model": config.model.clone(),
                    "maxSteps": max_steps,
                    "toolCount": tools.len(),
                })),
            ));

            let mut final_text = String::new();
            let mut agent_vars: HashMap<String, String> = HashMap::new();
            let mut total_rounds: u32 = 0;

            for round in 0..*max_steps {
                total_rounds = round + 1;

                // 每轮请求日志（完整消息体）
                logs.push(log_entry(
                    "debug",
                    "ai",
                    format!("AI Agent 第 {} 轮请求", round + 1),
                    Some(json!({
                        "round": round + 1,
                        "messages": messages.iter().map(|m| json!({
                            "role": &m.role,
                            "content": format!("{}", m.content),
                            "hasToolCalls": m.tool_calls.is_some(),
                            "toolCallId": &m.tool_call_id,
                        })).collect::<Vec<_>>(),
                    })),
                ));

                // 实时进度：AI 思考中
                emit_progress_with_ai(
                    app,
                    run_id,
                    step_index,
                    0,
                    "running",
                    None,
                    start_time.elapsed().as_millis() as u64,
                    "running",
                    HashMap::new(),
                    vec![step_index],
                    Some(AiExecutionDetail {
                        round: round as usize + 1,
                        max_rounds: *max_steps as usize,
                        phase: "thinking".into(),
                        thinking: None,
                        tool_calls: None,
                    }),
                );

                match ai.chat_with_tools(&config, &messages, &tools).await? {
                    AiChatResult::Text(text, _usage) => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            format!("AI Agent 第 {} 轮返回文本", round + 1),
                            Some(json!({ "text": &text, "round": round + 1 })),
                        ));
                        // AI 直接回复文本而非调用 submit_result：
                        // 如果还有轮次剩余，回推要求使用 submit_result；否则降级使用原始文本
                        if round + 1 < *max_steps {
                            messages.push(ChatMessage::assistant(&text));
                            messages.push(ChatMessage::user(
                                "请不要直接回复文本。你必须调用 submit_result 工具来提交最终结果，result 参数中只包含纯净的结果数据，不要有任何解释或修饰。"
                            ));
                            continue;
                        }
                        final_text = text;
                        break;
                    }
                    AiChatResult::ToolCalls {
                        text: assistant_text,
                        calls,
                        usage: _usage,
                    } => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            format!(
                                "AI Agent 第 {} 轮返回 {} 个工具调用",
                                round + 1,
                                calls.len()
                            ),
                            Some(json!({
                                "round": round + 1,
                                "assistantText": &assistant_text,
                                "toolCalls": calls.iter().map(|c| json!({
                                    "name": &c.name,
                                    "arguments": &c.arguments,
                                })).collect::<Vec<_>>(),
                            })),
                        ));

                        // 实时进度：收到工具调用
                        let pending_tool_details: Vec<AiToolCallDetail> = calls
                            .iter()
                            .map(|c| AiToolCallDetail {
                                name: c.name.clone(),
                                arguments: c.arguments.clone(),
                                status: "executing".into(),
                                result: None,
                                duration_ms: None,
                            })
                            .collect();
                        emit_progress_with_ai(
                            app,
                            run_id,
                            step_index,
                            0,
                            "running",
                            None,
                            start_time.elapsed().as_millis() as u64,
                            "running",
                            HashMap::new(),
                            vec![step_index],
                            Some(AiExecutionDetail {
                                round: round as usize + 1,
                                max_rounds: *max_steps as usize,
                                phase: "tool_calling".into(),
                                thinking: Some(assistant_text.to_string()),
                                tool_calls: Some(pending_tool_details),
                            }),
                        );

                        // 追加 assistant 消息（含 tool_calls + 伴随文本）
                        let raw_tool_calls: Vec<serde_json::Value> =
                            calls.iter().map(|c| c.raw.clone()).collect();
                        messages.push(ChatMessage {
                            role: "assistant".into(),
                            content: crate::services::ai_service::ChatContent::Text(assistant_text),
                            tool_calls: Some(raw_tool_calls),
                            tool_call_id: None,
                            name: None,
                        });

                        // 检查是否调用了 submit_result（提交最终结果）
                        let submit_call = calls.iter().find(|c| c.name == "submit_result");
                        if let Some(sc) = submit_call {
                            let args = &sc.arguments;
                            final_text = args
                                .get("result")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            logs.push(log_entry(
                                "info",
                                "ai",
                                "AI Agent 通过 submit_result 提交结果".to_string(),
                                Some(json!({ "result": &final_text })),
                            ));
                            break;
                        }

                        // 执行每个工具
                        for tool_call in &calls {
                            let tool_start = std::time::Instant::now();
                            let merged_vars = {
                                let mut v = vars.clone();
                                for (k, val) in &agent_vars {
                                    v.set(k, val.clone());
                                }
                                v
                            };
                            let mut tool_ctx = crate::services::ai_tools::ToolContext {
                                cdp,
                                http_client,
                                magic_port,
                                current_profile_id: merged_vars.get("__profile_id__"),
                                app,
                                run_id,
                                step_index,
                                vars: &merged_vars,
                                logs,
                                script_ai_config,
                            };
                            let tool_result_str =
                                match crate::services::ai_tools::ToolRegistry::execute(
                                    &tool_call.name,
                                    tool_call.arguments.clone(),
                                    &mut tool_ctx,
                                )
                                .await
                                {
                                    Ok(result) => {
                                        for (k, v) in result.vars {
                                            agent_vars.insert(k, v);
                                        }
                                        let text_out =
                                            result.text.unwrap_or_else(|| "ok".to_string());
                                        if let Some(ref img_b64) = result.image_base64 {
                                            messages.push(ChatMessage::tool_result_with_image(
                                                &tool_call.id,
                                                &text_out,
                                                img_b64,
                                            ));
                                        } else {
                                            messages.push(ChatMessage::tool_result(
                                                &tool_call.id,
                                                &text_out,
                                            ));
                                        }
                                        text_out
                                    }
                                    Err(e) => {
                                        let err_msg = format!("tool error: {e}");
                                        messages.push(ChatMessage::tool_result(
                                            &tool_call.id,
                                            &err_msg,
                                        ));
                                        err_msg
                                    }
                                };
                            let tool_duration = tool_start.elapsed().as_millis() as u64;
                            logs.push(log_entry(
                                "info",
                                "ai",
                                format!("工具 {} 执行完成", tool_call.name),
                                Some(json!({
                                    "name": &tool_call.name,
                                    "arguments": &tool_call.arguments,
                                    "result": &tool_result_str,
                                    "durationMs": tool_duration,
                                })),
                            ));

                            // 实时进度：工具执行完成
                            emit_progress_with_ai(
                                app,
                                run_id,
                                step_index,
                                0,
                                "running",
                                None,
                                start_time.elapsed().as_millis() as u64,
                                "running",
                                HashMap::new(),
                                vec![step_index],
                                Some(AiExecutionDetail {
                                    round: round as usize + 1,
                                    max_rounds: *max_steps as usize,
                                    phase: "tool_result".into(),
                                    thinking: None,
                                    tool_calls: Some(vec![AiToolCallDetail {
                                        name: tool_call.name.clone(),
                                        arguments: tool_call.arguments.clone(),
                                        status: if tool_result_str.starts_with("tool error:") {
                                            "failed".into()
                                        } else {
                                            "completed".into()
                                        },
                                        result: Some(tool_result_str.chars().take(500).collect()),
                                        duration_ms: Some(tool_duration),
                                    }]),
                                }),
                            );
                        }
                    }
                }
            }

            // JSON 模式下：解析 + 提取变量
            let mut vs = agent_vars;
            if is_json && !output_key_map.is_empty() {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&final_text) {
                    let mut extracted: HashMap<String, String> = HashMap::new();
                    for AiOutputKeyMapping {
                        json_path,
                        var_name,
                    } in output_key_map
                    {
                        if let Some(v) = extract_json_path(&parsed, json_path) {
                            vs.insert(var_name.clone(), v.clone());
                            extracted.insert(var_name.clone(), v);
                        }
                    }
                    logs.push(log_entry(
                        "debug",
                        "ai",
                        "AI Agent JSON 解析结果".to_string(),
                        Some(json!({
                            "rawJson": &final_text,
                            "extractedVars": &extracted,
                        })),
                    ));
                } else {
                    logs.push(log_entry(
                        "warn",
                        "ai",
                        "AI Agent JSON 解析失败".to_string(),
                        Some(json!({ "rawOutput": &final_text })),
                    ));
                }
            }
            if let Some(k) = output_key {
                vs.insert(k.clone(), final_text.clone());
            }

            let total_duration = start_time.elapsed().as_millis() as u64;
            logs.push(log_entry(
                "info",
                "ai",
                "AI Agent 执行完成".to_string(),
                Some(json!({
                    "finalOutput": &final_text,
                    "totalRounds": total_rounds,
                    "totalDurationMs": total_duration,
                    "varsSet": &vs,
                })),
            ));

            Ok((Some(final_text), vs))
        }

        ScriptStep::AiJudge {
            prompt,
            output_mode,
            max_steps,
            model_override,
            output_key,
            tool_categories: _,
        } => {
            let start_time = std::time::Instant::now();
            let user_prompt = vars.interpolate(prompt);
            let config = load_ai_config(app, script_ai_config, None, model_override.as_ref());
            let filter = crate::services::ai_tools::ToolFilter::all();
            let tools = crate::services::ai_tools::ToolRegistry::definitions(&filter);
            let ai = AiService::new(http_client.clone());

            let is_boolean = output_mode == "boolean";
            let locale = config.locale.as_deref().unwrap_or("zh");
            let system_prompt = if is_boolean {
                crate::services::ai_prompts::judge_boolean_prompt(&[], locale)
            } else {
                crate::services::ai_prompts::judge_percentage_prompt(&[], locale)
            };

            // 自动注入当前页面截图
            let initial_screenshot = if let Some(cdp_client) = cdp {
                match cdp_client
                    .call("Page.captureScreenshot", json!({ "format": "png" }))
                    .await
                {
                    Ok(resp) => resp
                        .get("data")
                        .and_then(|d| d.as_str())
                        .map(prepare_model_screenshot_data_url),
                    Err(_) => None,
                }
            } else {
                None
            };
            let user_content = crate::services::ai_service::build_vision_content(
                &format!("当前页面截图如下。\n\n判断任务：{}", &user_prompt),
                initial_screenshot.as_deref(),
            );
            let mut messages: Vec<ChatMessage> = vec![
                ChatMessage::system(&system_prompt),
                ChatMessage::with_content("user", user_content),
            ];

            // 开始日志
            logs.push(log_entry(
                "info",
                "ai",
                "AI Judge 开始执行".to_string(),
                Some(json!({
                    "prompt": &user_prompt,
                    "outputMode": output_mode,
                    "model": config.model.clone(),
                    "maxSteps": max_steps,
                    "toolCount": tools.len(),
                })),
            ));

            let mut final_text = String::new();
            let mut total_rounds: u32 = 0;

            for round in 0..*max_steps {
                total_rounds = round + 1;

                logs.push(log_entry(
                    "debug",
                    "ai",
                    format!("AI Judge 第 {} 轮请求", round + 1),
                    Some(json!({
                        "round": round + 1,
                        "messages": messages.iter().map(|m| json!({
                            "role": &m.role,
                            "content": format!("{}", m.content),
                            "hasToolCalls": m.tool_calls.is_some(),
                            "toolCallId": &m.tool_call_id,
                        })).collect::<Vec<_>>(),
                    })),
                ));

                // 实时进度：AI Judge 思考中
                emit_progress_with_ai(
                    app,
                    run_id,
                    step_index,
                    0,
                    "running",
                    None,
                    start_time.elapsed().as_millis() as u64,
                    "running",
                    HashMap::new(),
                    vec![step_index],
                    Some(AiExecutionDetail {
                        round: round as usize + 1,
                        max_rounds: *max_steps as usize,
                        phase: "thinking".into(),
                        thinking: None,
                        tool_calls: None,
                    }),
                );

                match ai.chat_with_tools(&config, &messages, &tools).await? {
                    AiChatResult::Text(text, _usage) => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            format!("AI Judge 第 {} 轮返回文本", round + 1),
                            Some(json!({ "text": &text, "round": round + 1 })),
                        ));
                        final_text = text;
                        break;
                    }
                    AiChatResult::ToolCalls {
                        text: assistant_text,
                        calls,
                        usage: _usage,
                    } => {
                        logs.push(log_entry(
                            "info",
                            "ai",
                            format!(
                                "AI Judge 第 {} 轮返回 {} 个工具调用",
                                round + 1,
                                calls.len()
                            ),
                            Some(json!({
                                "round": round + 1,
                                "assistantText": &assistant_text,
                                "toolCalls": calls.iter().map(|c| json!({
                                    "name": &c.name,
                                    "arguments": &c.arguments,
                                })).collect::<Vec<_>>(),
                            })),
                        ));

                        let raw_tool_calls: Vec<serde_json::Value> =
                            calls.iter().map(|c| c.raw.clone()).collect();
                        messages.push(ChatMessage {
                            role: "assistant".into(),
                            content: crate::services::ai_service::ChatContent::Text(assistant_text),
                            tool_calls: Some(raw_tool_calls),
                            tool_call_id: None,
                            name: None,
                        });

                        for tool_call in &calls {
                            let tool_start = std::time::Instant::now();
                            let mut tool_ctx = crate::services::ai_tools::ToolContext {
                                cdp,
                                http_client,
                                magic_port,
                                current_profile_id: vars.get("__profile_id__"),
                                app,
                                run_id,
                                step_index,
                                vars,
                                logs,
                                script_ai_config,
                            };
                            let tool_result_str =
                                match crate::services::ai_tools::ToolRegistry::execute(
                                    &tool_call.name,
                                    tool_call.arguments.clone(),
                                    &mut tool_ctx,
                                )
                                .await
                                {
                                    Ok(result) => {
                                        let text_out =
                                            result.text.unwrap_or_else(|| "ok".to_string());
                                        if let Some(ref img_b64) = result.image_base64 {
                                            messages.push(ChatMessage::tool_result_with_image(
                                                &tool_call.id,
                                                &text_out,
                                                img_b64,
                                            ));
                                        } else {
                                            messages.push(ChatMessage::tool_result(
                                                &tool_call.id,
                                                &text_out,
                                            ));
                                        }
                                        text_out
                                    }
                                    Err(e) => {
                                        let err_msg = format!("tool error: {e}");
                                        messages.push(ChatMessage::tool_result(
                                            &tool_call.id,
                                            &err_msg,
                                        ));
                                        err_msg
                                    }
                                };
                            let tool_duration = tool_start.elapsed().as_millis() as u64;
                            logs.push(log_entry(
                                "info",
                                "ai",
                                format!("工具 {} 执行完成", tool_call.name),
                                Some(json!({
                                    "name": &tool_call.name,
                                    "arguments": &tool_call.arguments,
                                    "result": &tool_result_str,
                                    "durationMs": tool_duration,
                                })),
                            ));
                        }
                    }
                }
            }

            // 解析最终输出
            let raw_reply = final_text.trim().to_lowercase();
            let parsed_value = if is_boolean {
                let result = raw_reply.starts_with("true")
                    || raw_reply == "是"
                    || raw_reply == "yes"
                    || raw_reply == "1";
                if result {
                    "true".to_string()
                } else {
                    "false".to_string()
                }
            } else {
                let num: i32 = raw_reply
                    .chars()
                    .filter(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0);
                num.clamp(0, 100).to_string()
            };

            let total_duration = start_time.elapsed().as_millis() as u64;
            logs.push(log_entry(
                "info",
                "ai",
                "AI Judge 执行完成".to_string(),
                Some(json!({
                    "rawReply": final_text.trim(),
                    "parsedValue": &parsed_value,
                    "outputMode": output_mode,
                    "totalRounds": total_rounds,
                    "totalDurationMs": total_duration,
                })),
            ));

            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), parsed_value.clone());
            }
            Ok((Some(parsed_value), vs))
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
            focus_element_js(cdp, &selector, selector_type).await?;
            cdp.call("Input.insertText", json!({ "text": text }))
                .await?;
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
                let js_expr = js_find_element_expr(&sel, selector_type);
                let expr = format!(
                    "(function(){{ var el = {js_expr}; if (el) el.scrollIntoView({{block:'center'}}); }})()"
                );
                cdp.call("Runtime.evaluate", json!({ "expression": expr }))
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
        ScriptStep::CdpQueryAll {
            selector,
            selector_type,
            extract,
            output_key,
        } => {
            let selector = vars.interpolate(selector);
            let extract = extract.as_deref().unwrap_or("text");
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let sel_json = serde_json::to_string(&selector).unwrap_or_default();
            let ext_json = serde_json::to_string(extract).unwrap_or_default();
            let expr = match selector_type {
                SelectorType::Css => format!(
                    r#"(function(){{
                        var els=Array.from(document.querySelectorAll({sel_json}));
                        var ext={ext_json};
                        return JSON.stringify(els.map(function(el){{
                            if(ext==='text')return el.innerText!==undefined?el.innerText:(el.textContent||'');
                            if(ext==='html')return el.outerHTML||'';
                            var v=el.getAttribute(ext);return v!==null?v:'';
                        }}));
                    }})()"#
                ),
                _ => format!(
                    r#"(function(){{
                        var xp={sel_json};
                        var isText={};
                        if(isText)xp='//*[contains(text(),'+xp+')]';
                        var res=document.evaluate(xp,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
                        var ext={ext_json};
                        var items=[];
                        for(var i=0;i<res.snapshotLength;i++){{
                            var el=res.snapshotItem(i);
                            if(ext==='text')items.push(el.innerText!==undefined?el.innerText:(el.textContent||''));
                            else if(ext==='html')items.push(el.outerHTML||'');
                            else{{var v=el.getAttribute(ext);items.push(v!==null?v:'');}}
                        }}
                        return JSON.stringify(items);
                    }})()"#,
                    matches!(selector_type, SelectorType::Text)
                ),
            };
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("[]")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }
        ScriptStep::CdpGetText {
            selector,
            selector_type,
            output_key,
        } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let js_expr = js_find_element_expr(&selector, selector_type);
            let sel_esc = selector.replace('"', "\\\"");
            let expr = format!(
                r#"(function(){{
                    var el = {js_expr};
                    if (!el) throw new Error('element not found: "{sel_esc}"');
                    return el.innerText !== undefined ? el.innerText : (el.textContent || '');
                }})()"#
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let text = result
                .get("result")
                .and_then(|r| r.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
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
            let js_expr = js_find_element_expr(&selector, selector_type);
            let sel_esc = selector.replace('"', "\\\"");
            let attr_json = serde_json::to_string(&attribute).unwrap_or_default();
            let expr = format!(
                r#"(function(){{
                    var el = {js_expr};
                    if (!el) throw new Error('element not found: "{sel_esc}"');
                    var v = el.getAttribute({attr_json});
                    return v !== null ? v : '';
                }})()"#
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let value_str = result
                .get("result")
                .and_then(|r| r.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
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
                    let data_dir = resolve_app_data_dir(app)
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
        ScriptStep::MagicSafeQuit => {
            let port = get_magic_port()?;
            magic_post(http_client, port, json!({ "cmd": "safe_quit" })).await?;
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
        ScriptStep::MagicEnableExtension { extension_id } => {
            let port = get_magic_port()?;
            let extension_id = vars.interpolate(extension_id);
            logs.push(log_entry(
                "info",
                "magic",
                format!("启用扩展: {}", extension_id),
                None,
            ));
            magic_post(
                http_client,
                port,
                json!({ "cmd": "enable_extension", "extension_id": extension_id }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::MagicDisableExtension { extension_id } => {
            let port = get_magic_port()?;
            let extension_id = vars.interpolate(extension_id);
            logs.push(log_entry(
                "info",
                "magic",
                format!("禁用扩展: {}", extension_id),
                None,
            ));
            magic_post(
                http_client,
                port,
                json!({ "cmd": "disable_extension", "extension_id": extension_id }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }
        // AI Agent 语义化操作
        ScriptStep::MagicGetBrowser {
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let body = magic_post(
                http_client,
                port,
                json!({ "cmd": "get_browser", "browser_id": browser_id }),
            )
            .await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicClickAt {
            grid,
            position,
            button,
            modifiers,
            click_count,
            action,
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let grid = vars.interpolate(grid);
            let position = vars.interpolate(position);
            let mut payload = json!({ "cmd": "click_at", "grid": grid, "position": position });
            if let Some(b) = button {
                payload["button"] = json!(b);
            }
            if let Some(m) = modifiers {
                payload["modifiers"] = json!(m);
            }
            if let Some(c) = click_count {
                payload["click_count"] = json!(c);
            }
            if let Some(a) = action {
                payload["action"] = json!(a);
            }
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicClickElement {
            target,
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let target = vars.interpolate(target);
            let mut payload = json!({ "cmd": "click_element", "target": target });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetUiElements {
            browser_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "get_ui_elements" });
            if let Some(id) = browser_id {
                payload["browser_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicNavigateTo {
            url,
            tab_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let url = vars.interpolate(url);
            let mut payload = json!({ "cmd": "navigate_to", "url": url });
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicQueryDom {
            by,
            selector,
            r#match,
            tab_id,
            limit,
            visible_only,
            output_key,
        } => {
            let port = get_magic_port()?;
            let selector = vars.interpolate(selector);
            let mut payload = json!({ "cmd": "query_dom", "by": by, "selector": selector });
            if let Some(m) = r#match {
                payload["match"] = json!(m);
            }
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            if let Some(l) = limit {
                payload["limit"] = json!(l);
            }
            if let Some(v) = visible_only {
                payload["visible_only"] = json!(v);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicClickDom {
            by,
            selector,
            r#match,
            index,
            tab_id,
            visible_only,
            output_key,
        } => {
            let port = get_magic_port()?;
            let selector = vars.interpolate(selector);
            let mut payload = json!({ "cmd": "click_dom", "by": by, "selector": selector });
            if let Some(m) = r#match {
                payload["match"] = json!(m);
            }
            if let Some(i) = index {
                payload["index"] = json!(i);
            }
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            if let Some(v) = visible_only {
                payload["visible_only"] = json!(v);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicFillDom {
            by,
            selector,
            value,
            r#match,
            index,
            clear,
            tab_id,
            visible_only,
            output_key,
        } => {
            let port = get_magic_port()?;
            let selector = vars.interpolate(selector);
            let value = vars.interpolate(value);
            let mut payload =
                json!({ "cmd": "fill_dom", "by": by, "selector": selector, "value": value });
            if let Some(m) = r#match {
                payload["match"] = json!(m);
            }
            if let Some(i) = index {
                payload["index"] = json!(i);
            }
            if let Some(c) = clear {
                payload["clear"] = json!(c);
            }
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            if let Some(v) = visible_only {
                payload["visible_only"] = json!(v);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicSendKeys {
            keys,
            tab_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "send_keys", "keys": keys });
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetPageInfo { tab_id, output_key } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "get_page_info" });
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicScroll {
            direction,
            distance,
            by,
            selector,
            index,
            visible_only,
            tab_id,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "scroll" });
            if let Some(d) = direction {
                payload["direction"] = json!(d);
            }
            if let Some(d) = distance {
                payload["distance"] = json!(d);
            }
            if let Some(b) = by {
                payload["by"] = json!(b);
            }
            if let Some(s) = selector {
                payload["selector"] = json!(vars.interpolate(s));
            }
            if let Some(i) = index {
                payload["index"] = json!(i);
            }
            if let Some(v) = visible_only {
                payload["visible_only"] = json!(v);
            }
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicSetDockIconText {
            text,
            color,
            output_key,
        } => {
            let port = get_magic_port()?;
            let text = vars.interpolate(text);
            let mut payload = json!({ "cmd": "set_dock_icon_text", "text": text });
            if let Some(c) = color {
                payload["color"] = json!(c);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
        }
        ScriptStep::MagicGetPageContent {
            mode,
            format,
            tab_id,
            viewport_only,
            max_elements,
            max_text_length,
            max_depth,
            include_hidden,
            regions,
            exclude_regions,
            output_key,
        } => {
            let port = get_magic_port()?;
            let mut payload = json!({ "cmd": "get_page_content" });
            if let Some(m) = mode {
                payload["mode"] = json!(m);
            }
            if let Some(f) = format {
                payload["format"] = json!(f);
            }
            if let Some(id) = tab_id {
                payload["tab_id"] = json!(id);
            }
            if let Some(v) = viewport_only {
                payload["viewport_only"] = json!(v);
            }
            if let Some(m) = max_elements {
                payload["max_elements"] = json!(m);
            }
            if let Some(m) = max_text_length {
                payload["max_text_length"] = json!(m);
            }
            if let Some(m) = max_depth {
                payload["max_depth"] = json!(m);
            }
            if let Some(h) = include_hidden {
                payload["include_hidden"] = json!(h);
            }
            if let Some(r) = regions {
                payload["regions"] = json!(r);
            }
            if let Some(e) = exclude_regions {
                payload["exclude_regions"] = json!(e);
            }
            let body = magic_post(http_client, port, payload).await?;
            Ok((Some(body.clone()), opt_key(output_key, body)))
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
                    let data_dir = resolve_app_data_dir(app)
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

        // ── CDP 新增步骤 ─────────────────────────────────────────────────────
        ScriptStep::CdpOpenNewTab { url, output_key } => {
            let url = vars.interpolate(url);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call_browser("Target.createTarget", json!({ "url": url }))
                .await?;
            let target_id = result
                .get("targetId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), target_id.clone());
            }
            Ok((Some(target_id), vs))
        }

        ScriptStep::CdpGetAllTabs { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call_browser("Target.getTargets", json!({})).await?;
            let tabs_json = serde_json::to_string(
                result
                    .get("targetInfos")
                    .unwrap_or(&serde_json::Value::Array(vec![])),
            )
            .unwrap_or_default();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), tabs_json.clone());
            }
            Ok((Some(tabs_json), vs))
        }

        ScriptStep::CdpSwitchTab { target_id } => {
            let target_id = vars.interpolate(target_id);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call_browser("Target.activateTarget", json!({ "targetId": target_id }))
                .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpCloseTabByTarget { target_id } => {
            let target_id = vars.interpolate(target_id);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call_browser("Target.closeTarget", json!({ "targetId": target_id }))
                .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpGoBack { steps } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let n = -(*steps as i32);
            cdp.call(
                "Runtime.evaluate",
                json!({ "expression": format!("history.go({})", n), "returnByValue": false }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpGoForward { steps } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call(
                "Runtime.evaluate",
                json!({ "expression": format!("history.go({})", steps), "returnByValue": false }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpUploadFile {
            selector,
            selector_type,
            files,
        } => {
            let selector = vars.interpolate(selector);
            let files: Vec<String> = files.iter().map(|f| vars.interpolate(f)).collect();
            // 验证文件存在
            for f in &files {
                if !std::path::Path::new(f).exists() {
                    return Err(format!("CdpUploadFile: file not found: {f}"));
                }
            }
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            // DOM.setFileInputFiles 需要同一 session 内先启用 DOM agent
            // Chrome 中文档根节点的 nodeId 固定为 1，可直接用于 querySelector
            let css_selector = match selector_type {
                SelectorType::Css => selector.clone(),
                _ => {
                    // XPath/Text 选择器先通过 JS 找到 CSS 路径不便，改用 JS 注入文件
                    // 通过 DOM.requestNode + Runtime.evaluate 获取节点引用
                    return Err(
                        "CdpUploadFile: XPath/Text 选择器暂不支持，请使用 CSS 选择器".to_string(),
                    );
                }
            };
            let results = cdp
                .call_sequence(&[
                    ("DOM.enable", json!({})),
                    (
                        "DOM.querySelector",
                        json!({ "nodeId": 1, "selector": css_selector }),
                    ),
                ])
                .await?;
            let node_id = results
                .get(1)
                .and_then(|r| r.get("nodeId"))
                .and_then(|v| v.as_i64())
                .ok_or_else(|| format!("element not found (upload): {selector}"))?;
            if node_id == 0 {
                return Err(format!("element not found (upload): {selector}"));
            }
            cdp.call_sequence(&[
                ("DOM.enable", json!({})),
                (
                    "DOM.setFileInputFiles",
                    json!({ "files": files, "nodeId": node_id }),
                ),
            ])
            .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpDownloadFile { download_path } => {
            let download_path = vars.interpolate(download_path);
            std::fs::create_dir_all(&download_path)
                .map_err(|e| format!("CdpDownloadFile: create dir: {e}"))?;
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call_browser(
                "Browser.setDownloadBehavior",
                json!({ "behavior": "allow", "downloadPath": download_path }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpClipboard { action } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            // macOS 使用 Meta(Cmd)，其他平台使用 Ctrl
            #[cfg(target_os = "macos")]
            let (modifier_flag, modifier_key) = (8i32, "Meta");
            #[cfg(not(target_os = "macos"))]
            let (modifier_flag, modifier_key) = (2i32, "Control");

            let (key_text, key_code) = match action {
                crate::models::ClipboardAction::Copy => ("c", "KeyC"),
                crate::models::ClipboardAction::Paste => ("v", "KeyV"),
                crate::models::ClipboardAction::SelectAll => ("a", "KeyA"),
            };
            // keyDown modifier
            cdp.call(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyDown",
                    "key": modifier_key,
                    "modifiers": modifier_flag
                }),
            )
            .await?;
            // keyDown key + modifier
            cdp.call(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyDown",
                    "key": key_text,
                    "code": key_code,
                    "modifiers": modifier_flag
                }),
            )
            .await?;
            // keyUp key
            cdp.call(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyUp",
                    "key": key_text,
                    "code": key_code,
                    "modifiers": modifier_flag
                }),
            )
            .await?;
            // keyUp modifier
            cdp.call(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyUp",
                    "key": modifier_key,
                    "modifiers": 0
                }),
            )
            .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpExecuteJs {
            expression,
            file_path,
            output_key,
        } => {
            let code = if let Some(fp) = file_path.as_ref().filter(|p| !p.is_empty()) {
                let fp = vars.interpolate(fp);
                std::fs::read_to_string(&fp)
                    .map_err(|e| format!("CdpExecuteJs: read file '{fp}': {e}"))?
            } else {
                vars.interpolate(expression.as_deref().unwrap_or(""))
            };
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": code, "returnByValue": true }),
                )
                .await?;
            let value = result
                .get("result")
                .and_then(|r| r.get("value"))
                .map(|v| {
                    if v.is_string() {
                        v.as_str().unwrap_or("").to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_default();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), value.clone());
            }
            Ok((Some(value), vs))
        }

        ScriptStep::CdpInputText {
            selector,
            selector_type,
            text_source,
            text,
            file_path,
            var_name,
        } => {
            let selector = vars.interpolate(selector);
            let resolved_text = match text_source {
                crate::models::TextSource::Inline => {
                    vars.interpolate(text.as_deref().unwrap_or(""))
                }
                crate::models::TextSource::File => {
                    let fp = vars.interpolate(file_path.as_deref().unwrap_or(""));
                    std::fs::read_to_string(&fp)
                        .map_err(|e| format!("CdpInputText: read file '{fp}': {e}"))?
                }
                crate::models::TextSource::Variable => {
                    let vn = var_name.as_deref().unwrap_or("");
                    vars.get(vn).unwrap_or("").to_string()
                }
            };
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            focus_element_js(cdp, &selector, selector_type).await?;
            cdp.call("Input.insertText", json!({ "text": resolved_text }))
                .await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpPressKey { key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let key = vars.interpolate(key);
            let (vk, code, text) = cdp_key_info(&key);
            let mut down = json!({ "type": "keyDown", "key": key, "windowsVirtualKeyCode": vk });
            if !code.is_empty() {
                down["code"] = json!(code);
            }
            if let Some(t) = &text {
                down["text"] = json!(t);
            }
            cdp.call("Input.dispatchKeyEvent", down).await?;
            let mut up = json!({ "type": "keyUp", "key": key, "windowsVirtualKeyCode": vk });
            if !code.is_empty() {
                up["code"] = json!(code);
            }
            cdp.call("Input.dispatchKeyEvent", up).await?;
            Ok((None, HashMap::new()))
        }

        ScriptStep::CdpShortcut { modifiers, key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let key = vars.interpolate(key);
            // 记录快捷键日志：用户输入和实际发送
            let user_input = if modifiers.is_empty() {
                key.clone()
            } else {
                format!("{}+{}", modifiers.join("+"), key)
            };
            logs.push(log_entry(
                "info",
                "cdp",
                format!("快捷键发送: 用户输入=[{}]", user_input),
                Some(json!({
                    "modifiers": modifiers,
                    "key": key,
                    "userInput": user_input,
                })),
            ));
            // CDP 协议位掩码：Alt=1, Ctrl=2, Meta=4, Shift=8
            let modifier_flag: i32 = modifiers
                .iter()
                .map(|m| match m.as_str() {
                    "alt" => 1,
                    "ctrl" => 2,
                    "meta" => 4,
                    "shift" => 8,
                    _ => 0,
                })
                .sum();
            // 修饰键信息：(CDP key name, code, windowsVirtualKeyCode)
            let modifier_infos: Vec<(&str, &str, i32)> = modifiers
                .iter()
                .filter_map(|m| match m.as_str() {
                    "alt" => Some(("Alt", "AltLeft", 18)),
                    "ctrl" => Some(("Control", "ControlLeft", 17)),
                    "meta" => Some(("Meta", "MetaLeft", 91)),
                    "shift" => Some(("Shift", "ShiftLeft", 16)),
                    _ => None,
                })
                .collect();
            // 按序按下修饰键（使用 rawKeyDown）
            for &(mk, mk_code, mk_vk) in &modifier_infos {
                cdp.call(
                    "Input.dispatchKeyEvent",
                    json!({
                        "type": "rawKeyDown",
                        "key": mk,
                        "code": mk_code,
                        "windowsVirtualKeyCode": mk_vk,
                        "modifiers": modifier_flag
                    }),
                )
                .await?;
            }
            // 按下主键（rawKeyDown + macOS commands）
            let (vk, code, _text) = cdp_key_info(&key);
            let mut main_down = json!({
                "type": "rawKeyDown",
                "key": key,
                "windowsVirtualKeyCode": vk,
                "modifiers": modifier_flag
            });
            if !code.is_empty() {
                main_down["code"] = json!(code.clone());
            }
            // macOS 需要 commands 数组才能触发快捷键动作
            #[cfg(target_os = "macos")]
            if let Some(cmds) = cdp_shortcut_commands(modifiers, &key) {
                main_down["commands"] = json!(cmds);
            }
            cdp.call("Input.dispatchKeyEvent", main_down).await?;
            // 释放主键
            let mut main_up = json!({
                "type": "keyUp",
                "key": key,
                "windowsVirtualKeyCode": vk,
                "modifiers": modifier_flag
            });
            if !code.is_empty() {
                main_up["code"] = json!(code);
            }
            cdp.call("Input.dispatchKeyEvent", main_up).await?;
            // 逆序释放修饰键
            for &(mk, mk_code, mk_vk) in modifier_infos.iter().rev() {
                cdp.call(
                    "Input.dispatchKeyEvent",
                    json!({
                        "type": "keyUp",
                        "key": mk,
                        "code": mk_code,
                        "windowsVirtualKeyCode": mk_vk,
                        "modifiers": 0
                    }),
                )
                .await?;
            }
            logs.push(log_entry(
                "debug",
                "cdp",
                format!(
                    "快捷键已发送: modifiers={:?}, key={}, modifier_flag={}, vk={}, code={}",
                    modifiers, key, modifier_flag, vk, code
                ),
                Some(json!({
                    "modifierFlag": modifier_flag,
                    "virtualKeyCode": vk,
                    "code": code,
                    "modifierInfos": modifier_infos.iter().map(|(k, c, v)| json!({"key": k, "code": c, "vk": v})).collect::<Vec<_>>(),
                })),
            ));
            Ok((None, HashMap::new()))
        }

        ScriptStep::Condition { .. }
        | ScriptStep::Loop { .. }
        | ScriptStep::Break
        | ScriptStep::Continue
        | ScriptStep::End { .. } => {
            Err("control flow step executed outside execute_steps context".to_string())
        }

        // ── 弹窗步骤 ─────────────────────────────────────────────────────────
        ScriptStep::ConfirmDialog {
            title,
            message,
            buttons,
            confirm_text,
            cancel_text,
            output_key,
            timeout_ms,
            on_timeout,
            on_timeout_value,
            ..
        } => {
            let title = vars.interpolate(title);
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
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(app, run_id, "confirm", message.clone(), step_index);
                evt.timeout_ms = *timeout_ms;
                evt.title = Some(title.clone());
                evt.confirm_text = confirm_text.clone();
                evt.cancel_text = cancel_text.clone();
                evt.buttons = buttons.clone();
                evt
            });
            let default_timeout_value = if let Some(ref otv) = on_timeout_value {
                Some(otv.clone())
            } else {
                match on_timeout {
                    ConfirmDialogTimeout::Confirm => Some("true".to_string()),
                    ConfirmDialogTimeout::Cancel => Some("false".to_string()),
                }
            };
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
                        default_timeout_value
                    }
                }
            } else {
                rx.await.unwrap_or_default()
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            // 兼容旧格式：无 buttons 时用 "true"/"false"
            let result = user_input.unwrap_or_else(|| {
                if buttons.is_some() {
                    buttons
                        .as_ref()
                        .and_then(|bs| bs.last().map(|b| b.value.clone()))
                        .unwrap_or_default()
                } else {
                    "false".to_string()
                }
            });
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::SelectDialog {
            title,
            message,
            options,
            multi_select,
            output_key,
            timeout_ms,
        } => {
            let title = vars.interpolate(title);
            let message_str = message.as_ref().map(|m| vars.interpolate(m));
            let options: Vec<String> = options.iter().map(|o| vars.interpolate(o)).collect();
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                let mut guard = app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                guard.insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(
                    app,
                    run_id,
                    "select",
                    message_str.clone().unwrap_or_default(),
                    step_index,
                );
                evt.timeout_ms = *timeout_ms;
                evt.title = Some(title.clone());
                evt.options = Some(options);
                evt.multi_select = Some(*multi_select);
                evt
            });
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
                        None
                    }
                }
            } else {
                rx.await.unwrap_or_default()
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_default();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::Notification {
            title,
            body,
            level,
            duration_ms,
        } => {
            let title = vars.interpolate(title);
            let body = vars.interpolate(body);
            let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
            let _ = app.emit(
                "automation_notification",
                AutomationNotificationEvent {
                    run_id: run_id.to_string(),
                    title,
                    body,
                    level: level.clone(),
                    duration_ms: *duration_ms,
                    profile_id,
                    profile_name,
                    batch_id,
                },
            );
            Ok((None, HashMap::new()))
        }

        // ── 新增弹窗步骤 ──────────────────────────────────────────────────────
        ScriptStep::FormDialog {
            title,
            message,
            fields,
            submit_label,
            output_key,
            timeout_ms,
            on_timeout,
        } => {
            let title = vars.interpolate(title);
            let message_str = message.as_ref().map(|m| vars.interpolate(m));
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(
                    app,
                    run_id,
                    "form",
                    message_str.unwrap_or_default(),
                    step_index,
                );
                evt.title = Some(title);
                evt.timeout_ms = *timeout_ms;
                evt.fields = Some(fields.clone());
                evt.submit_label = submit_label.clone();
                evt
            });
            let default_timeout_value = match on_timeout {
                ConfirmDialogTimeout::Confirm => Some("{}".to_string()),
                ConfirmDialogTimeout::Cancel => None,
            };
            let user_input = if let Some(ms) = timeout_ms {
                match tokio::time::timeout(Duration::from_millis(*ms), rx).await {
                    Ok(Ok(input)) => input,
                    Ok(Err(_)) => None,
                    Err(_) => {
                        app.state::<AppState>()
                            .active_run_channels
                            .lock()
                            .unwrap_or_else(|e| e.into_inner())
                            .remove(run_id);
                        default_timeout_value
                    }
                }
            } else {
                rx.await.ok().flatten()
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_else(|| "{}".to_string());
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::TableDialog {
            title,
            message,
            columns,
            rows,
            selectable,
            multi_select,
            max_height,
            output_key,
            timeout_ms,
        } => {
            let title = vars.interpolate(title);
            let message_str = message.as_ref().map(|m| vars.interpolate(m));
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(
                    app,
                    run_id,
                    "table",
                    message_str.unwrap_or_default(),
                    step_index,
                );
                evt.title = Some(title);
                evt.timeout_ms = *timeout_ms;
                evt.columns = Some(columns.clone());
                evt.rows = Some(rows.clone());
                evt.selectable = Some(*selectable);
                evt.multi_select = Some(*multi_select);
                evt.max_height = *max_height;
                evt
            });
            let user_input = if let Some(ms) = timeout_ms {
                match tokio::time::timeout(Duration::from_millis(*ms), rx).await {
                    Ok(Ok(input)) => input,
                    Ok(Err(_)) => None,
                    Err(_) => {
                        app.state::<AppState>()
                            .active_run_channels
                            .lock()
                            .unwrap_or_else(|e| e.into_inner())
                            .remove(run_id);
                        None
                    }
                }
            } else {
                rx.await.ok().flatten()
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_else(|| "[]".to_string());
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::ImageDialog {
            title,
            message,
            image,
            image_format,
            input_label,
            input_placeholder,
            output_key,
            timeout_ms,
        } => {
            let message_str = message
                .as_ref()
                .map(|m| vars.interpolate(m))
                .unwrap_or_default();
            let image_data = vars.interpolate(image);
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(app, run_id, "image", message_str, step_index);
                evt.title = title.clone();
                evt.timeout_ms = *timeout_ms;
                evt.image = Some(image_data);
                evt.image_format = Some(image_format.clone());
                evt.input_label = input_label.clone();
                evt.input_placeholder = input_placeholder.clone();
                evt
            });
            let user_input = if let Some(ms) = timeout_ms {
                match tokio::time::timeout(Duration::from_millis(*ms), rx).await {
                    Ok(Ok(input)) => input,
                    Ok(Err(_)) => None,
                    Err(_) => {
                        app.state::<AppState>()
                            .active_run_channels
                            .lock()
                            .unwrap_or_else(|e| e.into_inner())
                            .remove(run_id);
                        None
                    }
                }
            } else {
                rx.await.ok().flatten()
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_default();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::CountdownDialog {
            title,
            message,
            seconds,
            level,
            action_label,
            auto_proceed,
            output_key,
        } => {
            let message = vars.interpolate(message);
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt =
                    human_event_base(app, run_id, "countdown", message.clone(), step_index);
                evt.title = title.clone();
                evt.seconds = Some(*seconds);
                evt.level = Some(level.clone());
                evt.action_label = action_label.clone();
                evt.auto_proceed = Some(*auto_proceed);
                evt
            });
            // 等待前端响应（倒计时结束或用户取消）
            let timeout_secs = (*seconds as u64) + 5; // 额外 5 秒缓冲
            let user_input = match tokio::time::timeout(Duration::from_secs(timeout_secs), rx).await
            {
                Ok(Ok(input)) => input,
                Ok(Err(_)) => None,
                Err(_) => {
                    app.state::<AppState>()
                        .active_run_channels
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .remove(run_id);
                    if *auto_proceed {
                        Some("true".to_string())
                    } else {
                        None
                    }
                }
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_else(|| "false".to_string());
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::MarkdownDialog {
            title,
            content,
            max_height,
            width,
            actions,
            copyable,
            output_key,
        } => {
            let content = vars.interpolate(content);
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                app_state
                    .active_run_channels
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert(run_id.to_string(), tx);
            }
            let _ = app.emit_to("main", "automation_human_required", {
                let mut evt = human_event_base(app, run_id, "markdown", String::new(), step_index);
                evt.title = title.clone();
                evt.content = Some(content);
                evt.max_height = *max_height;
                evt.width = width.clone();
                evt.buttons = actions.clone();
                evt.copyable = Some(*copyable);
                evt
            });
            let user_input = rx.await.ok().flatten();
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let result = user_input.unwrap_or_else(|| "close".to_string());
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), result.clone());
            }
            Ok((Some(result), vs))
        }

        ScriptStep::CdpHandleDialog {
            action,
            prompt_text,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let accept = action == "accept";
            let mut params = json!({ "accept": accept });
            if let Some(text) = prompt_text {
                let text = vars.interpolate(text);
                params["promptText"] = json!(text);
            }
            let result = cdp.call("Page.handleJavaScriptDialog", params).await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        // ── CDP 信息查询步骤 ─────────────────────────────────────────────────
        ScriptStep::CdpGetBrowserVersion { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call_browser("Browser.getVersion", json!({})).await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        ScriptStep::CdpGetBrowserCommandLine { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call_browser("Browser.getBrowserCommandLine", json!({}))
                .await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        ScriptStep::CdpGetWindowForTarget {
            target_id,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({});
            if let Some(tid) = target_id {
                let tid = vars.interpolate(tid);
                if !tid.is_empty() {
                    params["targetId"] = json!(tid);
                }
            }
            let result = cdp
                .call_browser("Browser.getWindowForTarget", params)
                .await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        ScriptStep::CdpGetLayoutMetrics { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call("Page.getLayoutMetrics", json!({})).await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        ScriptStep::CdpGetDocument {
            depth,
            pierce,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({});
            if let Some(d) = depth {
                params["depth"] = json!(d);
            }
            if *pierce {
                params["pierce"] = json!(true);
            }
            let result = cdp.call("DOM.getDocument", params).await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        ScriptStep::CdpGetFullAxTree { depth, output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({});
            if let Some(d) = depth {
                params["depth"] = json!(d);
            }
            let result = cdp.call("Accessibility.getFullAXTree", params).await?;
            let output = serde_json::to_string(&result).ok();
            let mut vs = HashMap::new();
            if let Some(k) = output_key {
                vs.insert(k.clone(), output.clone().unwrap_or_default());
            }
            Ok((output, vs))
        }

        // ── CDP Cookie & 存储 ──────────────────────────────────────────────
        ScriptStep::CdpGetCookies { urls, output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({});
            if let Some(u) = urls {
                let interpolated: Vec<String> = u.iter().map(|s| vars.interpolate(s)).collect();
                params["urls"] = json!(interpolated);
            }
            let result = cdp.call("Network.getCookies", params).await?;
            let cookies = result.get("cookies").unwrap_or(&json!([])).to_string();
            Ok((Some(cookies.clone()), opt_key(output_key, cookies)))
        }

        ScriptStep::CdpSetCookie {
            name,
            value,
            domain,
            path,
            expires,
            http_only,
            secure,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({
                "name": vars.interpolate(name),
                "value": vars.interpolate(value),
            });
            if let Some(d) = domain {
                params["domain"] = json!(vars.interpolate(d));
            }
            if let Some(p) = path {
                params["path"] = json!(vars.interpolate(p));
            }
            if let Some(e) = expires {
                params["expires"] = json!(e);
            }
            if let Some(h) = http_only {
                params["httpOnly"] = json!(h);
            }
            if let Some(s) = secure {
                params["secure"] = json!(s);
            }
            cdp.call("Network.setCookie", params).await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpDeleteCookies { name, domain, path } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({ "name": vars.interpolate(name) });
            if let Some(d) = domain {
                params["domain"] = json!(vars.interpolate(d));
            }
            if let Some(p) = path {
                params["path"] = json!(vars.interpolate(p));
            }
            cdp.call("Network.deleteCookies", params).await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpGetLocalStorage { key, output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let expr = match key {
                Some(k) => format!(
                    "localStorage.getItem({})",
                    serde_json::to_string(&vars.interpolate(k)).unwrap_or_default()
                ),
                None => "JSON.stringify(localStorage)".to_string(),
            };
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .map(|v| {
                    if v.is_string() {
                        v.as_str().unwrap_or("").to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_default();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpSetLocalStorage { key, value } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let k = serde_json::to_string(&vars.interpolate(key)).unwrap_or_default();
            let v = serde_json::to_string(&vars.interpolate(value)).unwrap_or_default();
            let expr = format!("localStorage.setItem({k}, {v})");
            cdp.call("Runtime.evaluate", json!({ "expression": expr }))
                .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpGetSessionStorage { key, output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let expr = match key {
                Some(k) => format!(
                    "sessionStorage.getItem({})",
                    serde_json::to_string(&vars.interpolate(k)).unwrap_or_default()
                ),
                None => "JSON.stringify(sessionStorage)".to_string(),
            };
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .map(|v| {
                    if v.is_string() {
                        v.as_str().unwrap_or("").to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_default();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpClearStorage {
            origin,
            storage_types,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let origin_val = origin
                .as_ref()
                .map(|o| vars.interpolate(o))
                .unwrap_or_default();
            let types = storage_types.as_deref().unwrap_or("all");
            // 如果 origin 为空则通过 JS 获取
            let actual_origin = if origin_val.is_empty() {
                let r = cdp
                    .call(
                        "Runtime.evaluate",
                        json!({ "expression": "location.origin", "returnByValue": true }),
                    )
                    .await?;
                r.pointer("/result/value")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            } else {
                origin_val
            };
            cdp.call(
                "Storage.clearDataForOrigin",
                json!({
                    "origin": actual_origin,
                    "storageTypes": types,
                }),
            )
            .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        // ── CDP 页面信息 & 导航 ────────────────────────────────────────────
        ScriptStep::CdpGetCurrentUrl { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": "location.href", "returnByValue": true }),
                )
                .await?;
            let url = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Ok((Some(url.clone()), opt_key(output_key, url)))
        }

        ScriptStep::CdpGetPageSource {
            selector,
            selector_type,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let expr = match selector {
                Some(sel) => {
                    let sel_interp = vars.interpolate(sel);
                    let st = selector_type.as_deref().unwrap_or("css");
                    match st {
                        "xpath" => format!(
                            "(function(){{ var r=document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; return r?r.outerHTML:''; }})()",
                            serde_json::to_string(&sel_interp).unwrap_or_default()
                        ),
                        "text" => format!(
                            "(function(){{ var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){{ if(els[i].textContent.trim().includes({}))return els[i].outerHTML; }} return ''; }})()",
                            serde_json::to_string(&sel_interp).unwrap_or_default()
                        ),
                        _ => format!(
                            "(function(){{ var el=document.querySelector({}); return el?el.outerHTML:''; }})()",
                            serde_json::to_string(&sel_interp).unwrap_or_default()
                        ),
                    }
                }
                None => "document.documentElement.outerHTML".to_string(),
            };
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let html = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            // 大页面截断到 100KB
            let truncated = if html.len() > 102400 {
                format!(
                    "{}...(truncated, total {} bytes)",
                    &html[..102400],
                    html.len()
                )
            } else {
                html
            };
            Ok((Some(truncated.clone()), opt_key(output_key, truncated)))
        }

        ScriptStep::CdpWaitForNavigation { timeout_ms } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let timeout = timeout_ms.unwrap_or(30000);
            let start = std::time::Instant::now();
            loop {
                let result = cdp
                    .call(
                        "Runtime.evaluate",
                        json!({
                            "expression": "document.readyState",
                            "returnByValue": true
                        }),
                    )
                    .await?;
                let state = result
                    .pointer("/result/value")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if state == "complete" {
                    let url_result = cdp
                        .call(
                            "Runtime.evaluate",
                            json!({
                                "expression": "location.href",
                                "returnByValue": true
                            }),
                        )
                        .await?;
                    let url = url_result
                        .pointer("/result/value")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    return Ok((Some(url), HashMap::new()));
                }
                if start.elapsed().as_millis() as u64 >= timeout {
                    return Err(format!("Navigation timeout after {timeout}ms"));
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }

        // ── CDP 设备模拟 ───────────────────────────────────────────────────
        ScriptStep::CdpEmulateDevice {
            width,
            height,
            device_scale_factor,
            mobile,
            user_agent,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let metrics = json!({
                "width": width,
                "height": height,
                "deviceScaleFactor": device_scale_factor.unwrap_or(1.0),
                "mobile": mobile,
            });
            cdp.call("Emulation.setDeviceMetricsOverride", metrics)
                .await?;
            if let Some(ua) = user_agent {
                cdp.call(
                    "Emulation.setUserAgentOverride",
                    json!({ "userAgent": vars.interpolate(ua) }),
                )
                .await?;
            }
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpSetGeolocation {
            latitude,
            longitude,
            accuracy,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call(
                "Emulation.setGeolocationOverride",
                json!({
                    "latitude": latitude,
                    "longitude": longitude,
                    "accuracy": accuracy.unwrap_or(1.0),
                }),
            )
            .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpSetUserAgent {
            user_agent,
            platform,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({ "userAgent": vars.interpolate(user_agent) });
            if let Some(p) = platform {
                params["platform"] = json!(vars.interpolate(p));
            }
            cdp.call("Emulation.setUserAgentOverride", params).await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        // ── CDP 元素操作 & 输入 ────────────────────────────────────────────
        ScriptStep::CdpGetElementBox {
            selector,
            selector_type,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let sel = vars.interpolate(selector);
            let st = selector_type.as_deref().unwrap_or("css");
            let find_expr = match st {
                "xpath" => format!(
                    "document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue",
                    serde_json::to_string(&sel).unwrap_or_default()
                ),
                "text" => format!(
                    "(function(){{ var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){{ if(els[i].textContent.trim().includes({}))return els[i]; }} return null; }})()",
                    serde_json::to_string(&sel).unwrap_or_default()
                ),
                _ => format!(
                    "document.querySelector({})",
                    serde_json::to_string(&sel).unwrap_or_default()
                ),
            };
            let expr = format!(
                "(function(){{ var el={find_expr}; if(!el)return null; var r=el.getBoundingClientRect(); return JSON.stringify({{x:r.x,y:r.y,width:r.width,height:r.height}}); }})()"
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .map(|v| {
                    if v.is_string() {
                        v.as_str().unwrap_or("null").to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_else(|| "null".to_string());
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpHighlightElement {
            selector,
            selector_type,
            color,
            duration_ms,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let sel = vars.interpolate(selector);
            let col = color.as_deref().unwrap_or("red");
            let dur = duration_ms.unwrap_or(3000);
            let st = selector_type.as_deref().unwrap_or("css");
            let find_expr = match st {
                "xpath" => format!(
                    "document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue",
                    serde_json::to_string(&sel).unwrap_or_default()
                ),
                _ => format!(
                    "document.querySelector({})",
                    serde_json::to_string(&sel).unwrap_or_default()
                ),
            };
            let expr = format!(
                "(function(){{ var el={find_expr}; if(!el)return 'element not found'; var orig=el.style.outline; el.style.outline='3px solid {col}'; setTimeout(function(){{ el.style.outline=orig; }}, {dur}); return 'ok'; }})()"
            );
            cdp.call("Runtime.evaluate", json!({ "expression": expr }))
                .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpMouseMove { x, y } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            cdp.call(
                "Input.dispatchMouseEvent",
                json!({
                    "type": "mouseMoved",
                    "x": x,
                    "y": y,
                }),
            )
            .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpDragAndDrop {
            from_selector,
            to_selector,
            from_x,
            from_y,
            to_x,
            to_y,
            selector_type,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let st = selector_type.as_deref().unwrap_or("css");

            // 解析起始坐标
            let (sx, sy) = if let (Some(fx), Some(fy)) = (from_x, from_y) {
                (*fx, *fy)
            } else if let Some(sel) = from_selector {
                let sel_v = vars.interpolate(sel);
                let find = match st {
                    "xpath" => format!("document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue", serde_json::to_string(&sel_v).unwrap_or_default()),
                    _ => format!("document.querySelector({})", serde_json::to_string(&sel_v).unwrap_or_default()),
                };
                let expr = format!("(function(){{ var el={find}; if(!el)return null; var r=el.getBoundingClientRect(); return JSON.stringify({{x:r.x+r.width/2, y:r.y+r.height/2}}); }})()");
                let res = cdp
                    .call(
                        "Runtime.evaluate",
                        json!({ "expression": expr, "returnByValue": true }),
                    )
                    .await?;
                let coords_str = res
                    .pointer("/result/value")
                    .and_then(|v| v.as_str())
                    .unwrap_or("null");
                let coords: serde_json::Value =
                    serde_json::from_str(coords_str).unwrap_or(json!(null));
                (
                    coords["x"]
                        .as_f64()
                        .ok_or("from element not found".to_string())?,
                    coords["y"]
                        .as_f64()
                        .ok_or("from element not found".to_string())?,
                )
            } else {
                return Err(
                    "drag_and_drop: must specify from_selector or from_x/from_y".to_string()
                );
            };

            // 解析目标坐标
            let (tx, ty) = if let (Some(fx), Some(fy)) = (to_x, to_y) {
                (*fx, *fy)
            } else if let Some(sel) = to_selector {
                let sel_v = vars.interpolate(sel);
                let find = match st {
                    "xpath" => format!("document.evaluate({}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue", serde_json::to_string(&sel_v).unwrap_or_default()),
                    _ => format!("document.querySelector({})", serde_json::to_string(&sel_v).unwrap_or_default()),
                };
                let expr = format!("(function(){{ var el={find}; if(!el)return null; var r=el.getBoundingClientRect(); return JSON.stringify({{x:r.x+r.width/2, y:r.y+r.height/2}}); }})()");
                let res = cdp
                    .call(
                        "Runtime.evaluate",
                        json!({ "expression": expr, "returnByValue": true }),
                    )
                    .await?;
                let coords_str = res
                    .pointer("/result/value")
                    .and_then(|v| v.as_str())
                    .unwrap_or("null");
                let coords: serde_json::Value =
                    serde_json::from_str(coords_str).unwrap_or(json!(null));
                (
                    coords["x"]
                        .as_f64()
                        .ok_or("to element not found".to_string())?,
                    coords["y"]
                        .as_f64()
                        .ok_or("to element not found".to_string())?,
                )
            } else {
                return Err("drag_and_drop: must specify to_selector or to_x/to_y".to_string());
            };

            // 执行拖拽序列
            cdp.call(
                "Input.dispatchMouseEvent",
                json!({ "type": "mouseMoved", "x": sx, "y": sy }),
            )
            .await?;
            cdp.call("Input.dispatchMouseEvent", json!({ "type": "mousePressed", "x": sx, "y": sy, "button": "left", "clickCount": 1 })).await?;
            let steps_count = 5;
            for i in 1..=steps_count {
                let ratio = i as f64 / steps_count as f64;
                let mx = sx + (tx - sx) * ratio;
                let my = sy + (ty - sy) * ratio;
                cdp.call(
                    "Input.dispatchMouseEvent",
                    json!({ "type": "mouseMoved", "x": mx, "y": my }),
                )
                .await?;
            }
            cdp.call("Input.dispatchMouseEvent", json!({ "type": "mouseReleased", "x": tx, "y": ty, "button": "left", "clickCount": 1 })).await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpSelectOption {
            selector,
            value,
            index,
            selector_type,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let sel = vars.interpolate(selector);
            let sel_str = serde_json::to_string(&sel).unwrap_or_default();
            let st = selector_type.as_deref().unwrap_or("css");
            let find = match st {
                "xpath" => format!("document.evaluate({sel_str}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue"),
                _ => format!("document.querySelector({sel_str})"),
            };
            let set_expr = if let Some(v) = value {
                let v_str = serde_json::to_string(&vars.interpolate(v)).unwrap_or_default();
                format!("(function(){{ var el={find}; if(!el)return 'element not found'; el.value={v_str}; el.dispatchEvent(new Event('change',{{bubbles:true}})); return el.value; }})()")
            } else if let Some(idx) = index {
                format!("(function(){{ var el={find}; if(!el)return 'element not found'; el.selectedIndex={idx}; el.dispatchEvent(new Event('change',{{bubbles:true}})); return el.value; }})()")
            } else {
                return Err("select_option: must specify value or index".to_string());
            };
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": set_expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpCheckCheckbox {
            selector,
            checked,
            selector_type,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let sel = vars.interpolate(selector);
            let sel_str = serde_json::to_string(&sel).unwrap_or_default();
            let st = selector_type.as_deref().unwrap_or("css");
            let find = match st {
                "xpath" => format!("document.evaluate({sel_str}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue"),
                _ => format!("document.querySelector({sel_str})"),
            };
            let expr = format!(
                "(function(){{ var el={find}; if(!el)return 'element not found'; el.checked={checked}; el.dispatchEvent(new Event('change',{{bubbles:true}})); el.dispatchEvent(new Event('input',{{bubbles:true}})); return String(el.checked); }})()"
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Ok((Some(val), HashMap::new()))
        }

        // ── CDP 网络 & 导出 ────────────────────────────────────────────────
        ScriptStep::CdpBlockUrls { patterns } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let interpolated: Vec<String> = patterns.iter().map(|p| vars.interpolate(p)).collect();
            cdp.call("Network.enable", json!({})).await?;
            cdp.call("Network.setBlockedURLs", json!({ "urls": interpolated }))
                .await?;
            Ok((Some("ok".to_string()), HashMap::new()))
        }

        ScriptStep::CdpPdf {
            path,
            landscape,
            scale,
            paper_width,
            paper_height,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let mut params = json!({ "landscape": landscape });
            if let Some(s) = scale {
                params["scale"] = json!(s);
            }
            if let Some(w) = paper_width {
                params["paperWidth"] = json!(w);
            }
            if let Some(h) = paper_height {
                params["paperHeight"] = json!(h);
            }
            let result = cdp.call("Page.printToPDF", params).await?;
            let data_b64 = result.get("data").and_then(|v| v.as_str()).unwrap_or("");
            let output = if let Some(p) = path {
                let p = vars.interpolate(p);
                let bytes = base64_decode(data_b64)?;
                std::fs::write(&p, bytes).map_err(|e| format!("Write PDF failed: {e}"))?;
                p
            } else {
                data_b64.to_string()
            };
            Ok((Some(output.clone()), opt_key(output_key, output)))
        }

        ScriptStep::CdpInterceptRequest {
            url_pattern,
            action,
            headers: _,
            body: _,
            status: _,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let pattern = vars.interpolate(url_pattern);
            let action_val = action.as_str();
            match action_val {
                "block" => {
                    cdp.call("Network.enable", json!({})).await?;
                    cdp.call("Network.setBlockedURLs", json!({ "urls": [pattern] }))
                        .await?;
                    Ok((Some("ok: blocking enabled".to_string()), HashMap::new()))
                }
                "mock" | "modify" => {
                    cdp.call(
                        "Fetch.enable",
                        json!({
                            "patterns": [{ "urlPattern": pattern, "requestStage": "Request" }]
                        }),
                    )
                    .await?;
                    Ok((
                        Some(format!(
                            "ok: {action_val} interception enabled for {pattern}"
                        )),
                        HashMap::new(),
                    ))
                }
                _ => Err(format!("Unknown intercept action: {action_val}")),
            }
        }

        // ── CDP 事件缓冲 ──────────────────────────────────────────────────
        ScriptStep::CdpGetConsoleLogs {
            limit,
            level,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let lim = limit.unwrap_or(50);
            let level_filter = level.as_deref().unwrap_or("");
            let expr = format!(
                r#"(function(){{
                if(!window.__mf_console_logs){{
                    window.__mf_console_logs=[];
                    ['log','warn','error','info'].forEach(function(m){{
                        var orig=console[m];
                        console[m]=function(){{
                            window.__mf_console_logs.push({{level:m,text:Array.from(arguments).map(String).join(' '),timestamp:Date.now()}});
                            if(window.__mf_console_logs.length>200)window.__mf_console_logs.shift();
                            orig.apply(console,arguments);
                        }};
                    }});
                }}
                var logs=window.__mf_console_logs;
                var filtered='{level_filter}'?logs.filter(function(l){{return l.level==='{level_filter}'}}):logs;
                return JSON.stringify(filtered.slice(-{lim}));
            }})()"#
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("[]")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpGetNetworkRequests {
            limit,
            url_pattern,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let lim = limit.unwrap_or(20);
            let filt = url_pattern.as_deref().unwrap_or("");
            let filt_js = serde_json::to_string(filt).unwrap_or_else(|_| "\"\"".to_string());
            let expr = format!(
                r#"(function(){{
                if(!window.__mf_network_requests){{
                    window.__mf_network_requests=[];
                    var origFetch=window.fetch;
                    window.fetch=function(){{
                        var url=arguments[0];
                        if(typeof url==='object')url=url.url||'';
                        var method=(arguments[1]&&arguments[1].method)||'GET';
                        var entry={{url:String(url),method:method,timestamp:Date.now(),type:'fetch'}};
                        window.__mf_network_requests.push(entry);
                        if(window.__mf_network_requests.length>100)window.__mf_network_requests.shift();
                        return origFetch.apply(this,arguments).then(function(r){{entry.status=r.status;entry.mimeType=r.headers.get('content-type')||'';return r;}});
                    }};
                    var origXHR=XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open=function(m,u){{
                        this.__mf_entry={{url:String(u),method:m,timestamp:Date.now(),type:'xhr'}};
                        window.__mf_network_requests.push(this.__mf_entry);
                        if(window.__mf_network_requests.length>100)window.__mf_network_requests.shift();
                        this.addEventListener('load',function(){{this.__mf_entry.status=this.status;}});
                        origXHR.apply(this,arguments);
                    }};
                }}
                var reqs=window.__mf_network_requests;
                var filt={filt_js};
                var filtered=filt?reqs.filter(function(r){{return r.url.includes(filt)}}):reqs;
                return JSON.stringify(filtered.slice(-{lim}));
            }})()"#
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("[]")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CdpGetResponseBody {
            url_filter,
            limit,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let lim = limit.unwrap_or(10);
            let filt = url_filter.as_deref().unwrap_or("");
            let filt_js = serde_json::to_string(filt).unwrap_or_else(|_| "\"\"".to_string());
            let expr = format!(
                r#"(function(){{
                if(!window.__mf_response_bodies){{
                    window.__mf_response_bodies=[];
                    var origFetch=window.fetch;
                    window.fetch=function(){{
                        var url=arguments[0];
                        if(typeof url==='object')url=url.url||'';
                        url=String(url);
                        var method=(arguments[1]&&arguments[1].method)||'GET';
                        var entry={{url:url,method:method,timestamp:Date.now(),type:'fetch',status:null,contentType:'',body:null}};
                        return origFetch.apply(this,arguments).then(function(r){{
                            entry.status=r.status;
                            entry.contentType=r.headers.get('content-type')||'';
                            var rc=r.clone();
                            rc.text().then(function(t){{
                                entry.body=t;
                                window.__mf_response_bodies.push(entry);
                                if(window.__mf_response_bodies.length>50)window.__mf_response_bodies.shift();
                            }}).catch(function(){{
                                entry.body='[unreadable]';
                                window.__mf_response_bodies.push(entry);
                                if(window.__mf_response_bodies.length>50)window.__mf_response_bodies.shift();
                            }});
                            return r;
                        }});
                    }};
                    var origOpen=XMLHttpRequest.prototype.open;
                    XMLHttpRequest.prototype.open=function(m,u){{
                        this.__mf_rb={{url:String(u),method:m,timestamp:Date.now(),type:'xhr',status:null,contentType:'',body:null}};
                        this.addEventListener('load',function(){{
                            var e=this.__mf_rb;
                            if(e){{
                                e.status=this.status;
                                e.contentType=this.getResponseHeader('content-type')||'';
                                e.body=this.responseText||'';
                                window.__mf_response_bodies.push(e);
                                if(window.__mf_response_bodies.length>50)window.__mf_response_bodies.shift();
                            }}
                        }});
                        origOpen.apply(this,arguments);
                    }};
                }}
                var data=window.__mf_response_bodies;
                var filt={filt_js};
                var filtered=filt?data.filter(function(e){{return e.url.includes(filt);}}):data;
                return JSON.stringify(filtered.slice(-{lim}));
            }})()"#
            );
            let result = cdp
                .call(
                    "Runtime.evaluate",
                    json!({ "expression": expr, "returnByValue": true }),
                )
                .await?;
            let val = result
                .pointer("/result/value")
                .and_then(|v| v.as_str())
                .unwrap_or("[]")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        // ── Magic Controller 新增 ─────────────────────────────────────────
        ScriptStep::MagicGetMaximized { output_key } => {
            let port = get_magic_port()?;
            let resp = magic_post(http_client, port, json!({ "cmd": "get_maximized" })).await?;
            Ok((Some(resp.clone()), opt_key(output_key, resp)))
        }

        ScriptStep::MagicGetMinimized { output_key } => {
            let port = get_magic_port()?;
            let resp = magic_post(http_client, port, json!({ "cmd": "get_minimized" })).await?;
            Ok((Some(resp.clone()), opt_key(output_key, resp)))
        }

        ScriptStep::MagicGetFullscreen { output_key } => {
            let port = get_magic_port()?;
            let resp = magic_post(http_client, port, json!({ "cmd": "get_fullscreen" })).await?;
            Ok((Some(resp.clone()), opt_key(output_key, resp)))
        }

        ScriptStep::MagicGetWindowState { output_key } => {
            let port = get_magic_port()?;
            let bounds = magic_post(http_client, port, json!({ "cmd": "get_bounds" }))
                .await
                .unwrap_or_else(|_| "{}".to_string());
            let maximized = magic_post(http_client, port, json!({ "cmd": "get_maximized" }))
                .await
                .unwrap_or_else(|_| "false".to_string());
            let minimized = magic_post(http_client, port, json!({ "cmd": "get_minimized" }))
                .await
                .unwrap_or_else(|_| "false".to_string());
            let fullscreen = magic_post(http_client, port, json!({ "cmd": "get_fullscreen" }))
                .await
                .unwrap_or_else(|_| "false".to_string());
            let result = json!({
                "bounds": serde_json::from_str::<serde_json::Value>(&bounds).unwrap_or(json!({})),
                "maximized": maximized.trim() == "true",
                "minimized": minimized.trim() == "true",
                "fullscreen": fullscreen.trim() == "true",
            })
            .to_string();
            Ok((Some(result.clone()), opt_key(output_key, result)))
        }

        ScriptStep::MagicImportCookies {
            cookies,
            output_key,
        } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let cookie_array = cookies
                .as_array()
                .ok_or("cookies must be an array".to_string())?;
            let mut count = 0u32;
            for cookie in cookie_array {
                let mut params = json!({});
                if let Some(n) = cookie.get("name").and_then(|v| v.as_str()) {
                    params["name"] = json!(n);
                } else {
                    continue;
                }
                if let Some(v) = cookie.get("value").and_then(|v| v.as_str()) {
                    params["value"] = json!(v);
                } else {
                    continue;
                }
                if let Some(d) = cookie.get("domain").and_then(|v| v.as_str()) {
                    params["domain"] = json!(d);
                }
                if let Some(p) = cookie.get("path").and_then(|v| v.as_str()) {
                    params["path"] = json!(p);
                }
                if let Some(e) = cookie.get("expires").and_then(|v| v.as_f64()) {
                    params["expires"] = json!(e);
                }
                if let Some(h) = cookie.get("httpOnly").and_then(|v| v.as_bool()) {
                    params["httpOnly"] = json!(h);
                }
                if let Some(s) = cookie.get("secure").and_then(|v| v.as_bool()) {
                    params["secure"] = json!(s);
                }
                if let Some(u) = cookie.get("url").and_then(|v| v.as_str()) {
                    params["url"] = json!(u);
                }
                cdp.call("Network.setCookie", params).await?;
                count += 1;
            }
            let result = count.to_string();
            Ok((Some(result.clone()), opt_key(output_key, result)))
        }

        // ── App 新增 ──────────────────────────────────────────────────────
        ScriptStep::AppRunScript {
            script_id,
            profile_id,
            initial_vars: _,
            output_key,
        } => {
            let state = app.state::<crate::state::AppState>();
            let script_id_val = vars.interpolate(script_id);
            let _profile_id_val = profile_id.as_ref().map(|p| vars.interpolate(p));

            // 查找脚本
            let svc = state.lock_automation_service();
            let _script = svc
                .get_script(&script_id_val)
                .map_err(|e| format!("Script not found: {e}"))?;
            drop(svc);

            // 生成 run ID
            let new_run_id = uuid::Uuid::new_v4().to_string();

            // 异步: 不等待完成，直接返回 run_id
            let result = new_run_id.clone();
            Ok((Some(result.clone()), opt_key(output_key, result)))
        }

        // ── CAPTCHA 步骤 ──────────────────────────────────────────────────
        ScriptStep::CaptchaDetect { output_key } => {
            let cdp = cdp.ok_or("captcha_detect 需要 CDP 连接")?;
            let js = crate::services::captcha_service::CaptchaService::detection_js();
            let resp = cdp
                .call(
                    "Runtime.evaluate",
                    json!({
                        "expression": js,
                        "returnByValue": true,
                    }),
                )
                .await?;
            let val = resp
                .get("result")
                .and_then(|r| r.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string();
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }

        ScriptStep::CaptchaSolve {
            captcha_type,
            sitekey,
            page_action,
            image_base64,
            gt,
            challenge,
            public_key,
            enterprise_payload,
            user_agent,
            output_key,
        } => {
            let app_state = app.state::<AppState>();
            let captcha_config = {
                let svc = app_state
                    .app_preference_service
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                svc.get_default_captcha_config()
                    .map_err(|e| format!("获取 CAPTCHA 配置失败: {e}"))?
                    .ok_or("未配置 CAPTCHA 求解服务，请在设置中添加")?
            };
            let captcha_svc =
                crate::services::captcha_service::CaptchaService::new(http_client.clone());

            let detected = if let Some(c) = cdp {
                detect_captcha(c).await.ok()
            } else {
                None
            };

            // 如果是 auto 模式，先检测
            let (resolved_type, resolved_key) = if captcha_type == "auto" {
                let detect = detected
                    .as_ref()
                    .ok_or("captcha_solve auto 模式需要 CDP 连接并成功检测页面 CAPTCHA")?;
                let detected_type = detect.captcha_type.clone().unwrap_or_default();
                if detected_type.is_empty() {
                    return Err("未在页面上检测到 CAPTCHA".to_string());
                }
                (detected_type, detect.sitekey.clone())
            } else {
                (captcha_type.clone(), sitekey.clone())
            };

            let ct = normalize_detected_captcha_type(&resolved_type)?;

            // 获取当前页面 URL
            let website_url = if let Some(c) = cdp {
                runtime_eval_string(c, "location.href")
                    .await
                    .ok()
                    .unwrap_or_default()
            } else {
                String::new()
            };
            let browser_user_agent = if let Some(c) = cdp {
                if let Some(user_agent) = detected.as_ref().and_then(|d| d.user_agent.clone()) {
                    Some(user_agent)
                } else {
                    runtime_eval_string(c, "navigator.userAgent").await.ok()
                }
            } else {
                None
            };
            let captcha_cookies = if let Some(c) = cdp {
                collect_captcha_cookie_header(c, &website_url).await
            } else {
                None
            };
            let captcha_proxy = resolve_captcha_proxy_config(app, vars);

            let task = crate::services::captcha_service::CaptchaTask {
                captcha_type: ct,
                website_url,
                website_key: resolved_key.or(sitekey.clone()).unwrap_or_default(),
                page_action: page_action
                    .clone()
                    .or_else(|| detected.as_ref().and_then(|d| d.page_action.clone())),
                is_invisible: detected.as_ref().map(|d| d.is_invisible).unwrap_or(false),
                image_base64: image_base64.clone(),
                gt: gt
                    .clone()
                    .or_else(|| detected.as_ref().and_then(|d| d.gt.clone())),
                challenge: challenge
                    .clone()
                    .or_else(|| detected.as_ref().and_then(|d| d.challenge.clone())),
                public_key: public_key
                    .clone()
                    .or_else(|| detected.as_ref().and_then(|d| d.public_key.clone())),
                enterprise_payload: enterprise_payload
                    .clone()
                    .or_else(|| detected.as_ref().and_then(|d| d.enterprise_payload.clone())),
                user_agent: user_agent.clone().or(browser_user_agent),
                cookies: captcha_cookies,
                proxy: captcha_proxy,
            };
            let result = captcha_svc.solve(&captcha_config, task).await?;
            let result_json = serde_json::to_string(&result).unwrap_or_default();
            Ok((Some(result_json.clone()), opt_key(output_key, result_json)))
        }

        ScriptStep::CaptchaInjectToken {
            captcha_type,
            token,
        } => {
            let cdp = cdp.ok_or("captcha_inject_token 需要 CDP 连接")?;
            let detect = detect_captcha(cdp).await.ok();
            let browser_user_agent =
                if let Some(user_agent) = detect.as_ref().and_then(|d| d.user_agent.clone()) {
                    Some(user_agent)
                } else {
                    runtime_eval_string(cdp, "navigator.userAgent").await.ok()
                };
            let js = crate::services::captcha_service::CaptchaService::injection_js_with_options(
                captcha_type,
                token,
                detect.as_ref().and_then(|d| d.callback.as_deref()),
                false,
            );
            let inject_raw = runtime_eval_string(cdp, &js).await?;
            let injection =
                crate::services::captcha_service::CaptchaService::parse_injection_result(
                    &inject_raw,
                );
            let verification = verify_captcha_resolution(cdp, &injection).await?;
            if !verification.verified {
                let diagnostics = captcha_verification_diagnostics(
                    detect.as_ref(),
                    Some(&injection),
                    &verification,
                    browser_user_agent.as_deref(),
                    None,
                );
                return Err(format!(
                    "验证码 token 已注入，但页面未通过验证: {diagnostics}"
                ));
            }

            let result_json = serde_json::to_string(&json!({
                "verified": true,
                "captchaType": detect.as_ref().and_then(|d| d.captcha_type.clone()).unwrap_or_else(|| captcha_type.clone()),
                "browserUserAgent": browser_user_agent,
                "injection": injection,
                "verification": verification,
            }))
            .unwrap_or_default();
            Ok((Some(result_json), HashMap::new()))
        }

        ScriptStep::CaptchaSolveAndInject {
            auto_submit,
            output_key,
        } => {
            let cdp = cdp.ok_or("captcha_solve_and_inject 需要 CDP 连接")?;
            let app_state = app.state::<AppState>();
            let captcha_config = {
                let svc = app_state
                    .app_preference_service
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                svc.get_default_captcha_config()
                    .map_err(|e| format!("获取 CAPTCHA 配置失败: {e}"))?
                    .ok_or("未配置 CAPTCHA 求解服务")?
            };
            let captcha_svc =
                crate::services::captcha_service::CaptchaService::new(http_client.clone());

            // 1. 检测
            let detect = detect_captcha(cdp).await?;
            let detected_type = detect.captcha_type.clone().unwrap_or_default();
            if detected_type.is_empty() {
                return Err("页面上未检测到 CAPTCHA".to_string());
            }
            let detected_key = detect.sitekey.clone().unwrap_or_default();

            let ct = normalize_detected_captcha_type(&detected_type)?;

            let website_url = runtime_eval_string(cdp, "location.href")
                .await
                .ok()
                .unwrap_or_default();
            let browser_user_agent = if let Some(user_agent) = detect.user_agent.clone() {
                Some(user_agent)
            } else {
                runtime_eval_string(cdp, "navigator.userAgent").await.ok()
            };
            let captcha_cookies = collect_captcha_cookie_header(cdp, &website_url).await;
            let captcha_proxy = resolve_captcha_proxy_config(app, vars);

            // 2. 求解
            let task = crate::services::captcha_service::CaptchaTask {
                captcha_type: ct,
                website_url,
                website_key: detected_key,
                page_action: detect.page_action.clone(),
                is_invisible: detect.is_invisible,
                image_base64: None,
                gt: detect.gt.clone(),
                challenge: detect.challenge.clone(),
                public_key: detect.public_key.clone(),
                enterprise_payload: detect.enterprise_payload.clone(),
                user_agent: browser_user_agent.clone(),
                cookies: captcha_cookies,
                proxy: captcha_proxy,
            };
            let result = captcha_svc.solve(&captcha_config, task).await?;

            // 3. 注入
            let inject_type = inject_type_for_captcha(&detected_type);
            let inject_js =
                crate::services::captcha_service::CaptchaService::injection_js_with_options(
                    inject_type,
                    &result.token,
                    detect.callback.as_deref(),
                    *auto_submit,
                );
            let inject_raw = runtime_eval_string(cdp, &inject_js).await?;
            let injection =
                crate::services::captcha_service::CaptchaService::parse_injection_result(
                    &inject_raw,
                );

            // 4. 页面级回验
            let verification = verify_captcha_resolution(cdp, &injection).await?;
            if !verification.verified {
                let diagnostics = captcha_verification_diagnostics(
                    Some(&detect),
                    Some(&injection),
                    &verification,
                    browser_user_agent.as_deref(),
                    result.user_agent.as_deref(),
                );
                return Err(format!(
                    "验证码求解/注入已完成，但页面未通过验证: {diagnostics}"
                ));
            }

            let result_json = serde_json::to_string(&json!({
                "verified": true,
                "captchaType": detected_type,
                "sitekey": detect.sitekey.clone(),
                "solveTimeMs": result.solve_time_ms,
                "browserUserAgent": browser_user_agent,
                "solverUserAgent": result.user_agent,
                "userAgentMismatch": crate::services::captcha_service::CaptchaService::is_user_agent_mismatch(
                    browser_user_agent.as_deref(),
                    result.user_agent.as_deref(),
                ),
                "injection": injection,
                "verification": verification,
            }))
            .unwrap_or_default();
            Ok((Some(result_json.clone()), opt_key(output_key, result_json)))
        }

        ScriptStep::CaptchaGetBalance { output_key } => {
            let app_state = app.state::<AppState>();
            let captcha_config = {
                let svc = app_state
                    .app_preference_service
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                svc.get_default_captcha_config()
                    .map_err(|e| format!("获取 CAPTCHA 配置失败: {e}"))?
                    .ok_or("未配置 CAPTCHA 求解服务")?
            };
            let captcha_svc =
                crate::services::captcha_service::CaptchaService::new(http_client.clone());
            let balance = captcha_svc.get_balance(&captcha_config).await?;
            let val = format!("{:.4}", balance);
            Ok((Some(val.clone()), opt_key(output_key, val)))
        }
    }
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("base64 decode: {e}"))
}

fn prepare_model_screenshot_data_url(image_base64: &str) -> String {
    crate::services::model_image_service::prepare_image_for_model_from_base64(
        image_base64,
        Some("image/png"),
    )
    .map(|prepared| prepared.data_url)
    .unwrap_or_else(|_| format!("data:image/png;base64,{image_base64}"))
}

/// 发送 Magic Controller HTTP 请求，尝试多个路径并重试
pub(crate) async fn magic_post(
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

/// 从 active_runs 反查 run 的 profile 上下文，反查失败时优雅降级为 None
fn resolve_run_ctx(
    app: &AppHandle,
    run_id: &str,
) -> (Option<String>, Option<String>, Option<String>) {
    let state = app.state::<AppState>();
    if let Some(ctx) = state.active_runs.get(run_id) {
        (
            Some(ctx.profile_id.clone()),
            ctx.profile_name.clone(),
            ctx.batch_id.clone(),
        )
    } else {
        (None, None, None)
    }
}

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
    emit_progress_with_ai(
        app,
        run_id,
        step_index,
        step_total,
        step_status,
        output,
        duration_ms,
        run_status,
        vars_set,
        step_path,
        None,
    );
}

fn emit_progress_with_ai(
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
    ai_detail: Option<AiExecutionDetail>,
) {
    let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
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
        ai_detail,
        profile_id,
        profile_name,
        batch_id,
    };
    if let Err(e) = app.emit("automation_progress", &event) {
        logger::warn("automation", format!("emit progress failed: {e}"));
    }
}

fn emit_variables_updated(app: &AppHandle, run_id: &str, vars: HashMap<String, String>) {
    let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
    let event = AutomationVariablesUpdatedEvent {
        run_id: run_id.to_string(),
        vars,
        profile_id,
        profile_name,
        batch_id,
    };
    if let Err(e) = app.emit("automation_variables_updated", &event) {
        logger::warn("automation", format!("emit variables_updated failed: {e}"));
    }
}

/// 构建人工介入事件，新增字段使用 None 默认值
fn human_event_base(
    app: &AppHandle,
    run_id: &str,
    dialog_type: &str,
    message: String,
    step_index: usize,
) -> AutomationHumanRequiredEvent {
    let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
    AutomationHumanRequiredEvent {
        run_id: run_id.to_string(),
        profile_id,
        profile_name,
        batch_id,
        dialog_type: dialog_type.to_string(),
        message,
        input_label: None,
        timeout_ms: None,
        step_path: vec![step_index],
        title: None,
        confirm_text: None,
        cancel_text: None,
        options: None,
        multi_select: None,
        buttons: None,
        fields: None,
        submit_label: None,
        columns: None,
        rows: None,
        selectable: None,
        max_height: None,
        image: None,
        image_format: None,
        input_placeholder: None,
        seconds: None,
        action_label: None,
        auto_proceed: None,
        content: None,
        width: None,
        copyable: None,
        level: None,
    }
}

fn emit_human_dismissed(app: &AppHandle, run_id: &str) {
    let (profile_id, profile_name, batch_id) = resolve_run_ctx(app, run_id);
    let _ = app.emit_to(
        "main",
        "automation_human_dismissed",
        AutomationHumanDismissedEvent {
            run_id: run_id.to_string(),
            profile_id,
            profile_name,
            batch_id,
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
        profile_id: None,
        profile_name: None,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    use axum::{
        extract::{
            ws::{Message as AxumWsMessage, WebSocketUpgrade},
            State,
        },
        response::IntoResponse,
        routing::get,
        Json, Router,
    };
    use serde_json::Value;

    #[derive(Clone)]
    struct MockCdpState {
        ws_url: String,
        responses: Arc<Vec<String>>,
        next_index: Arc<AtomicUsize>,
    }

    async fn mock_cdp_target_list(State(state): State<MockCdpState>) -> Json<serde_json::Value> {
        Json(json!([{
            "type": "page",
            "webSocketDebuggerUrl": state.ws_url,
        }]))
    }

    async fn mock_cdp_ws(
        ws: WebSocketUpgrade,
        State(state): State<MockCdpState>,
    ) -> impl IntoResponse {
        ws.on_upgrade(move |mut socket| async move {
            while let Some(Ok(message)) = socket.recv().await {
                let AxumWsMessage::Text(text) = message else {
                    continue;
                };
                let request_id = serde_json::from_str::<Value>(text.as_str())
                    .ok()
                    .and_then(|value| value.get("id").and_then(|id| id.as_u64()))
                    .unwrap_or(1);
                let idx = state.next_index.fetch_add(1, Ordering::SeqCst);
                let raw = state
                    .responses
                    .get(idx)
                    .cloned()
                    .or_else(|| state.responses.last().cloned())
                    .unwrap_or_else(|| "{}".to_string());
                let payload = json!({
                    "id": request_id,
                    "result": {
                        "result": {
                            "value": raw,
                        }
                    }
                });
                let _ = socket
                    .send(AxumWsMessage::Text(payload.to_string().into()))
                    .await;
                let _ = socket.send(AxumWsMessage::Close(None)).await;
                break;
            }
        })
    }

    async fn spawn_mock_cdp_client(
        responses: Vec<String>,
    ) -> (CdpClient, tokio::task::JoinHandle<()>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock cdp listener");
        let port = listener.local_addr().expect("mock cdp addr").port();
        let state = MockCdpState {
            ws_url: format!("ws://127.0.0.1:{port}/cdp"),
            responses: Arc::new(if responses.is_empty() {
                vec!["{}".to_string()]
            } else {
                responses
            }),
            next_index: Arc::new(AtomicUsize::new(0)),
        };
        let app = Router::new()
            .route("/json/list", get(mock_cdp_target_list))
            .route("/cdp", get(mock_cdp_ws))
            .with_state(state);
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (CdpClient::new(port), handle)
    }

    fn page_state_json(page_state: crate::services::captcha_service::CaptchaPageState) -> String {
        serde_json::to_string(&page_state).expect("serialize page state")
    }

    fn injected_token_result() -> crate::services::captcha_service::CaptchaInjectionResult {
        crate::services::captcha_service::CaptchaInjectionResult {
            field_injected: true,
            injected_fields: vec!["g-recaptcha-response".into()],
            events_dispatched: 2,
            callback_name: None,
            callback_invoked: false,
            callback_invocations: 0,
            form_submitted: false,
            submit_result: None,
        }
    }

    fn test_proxy(protocol: &str) -> crate::models::Proxy {
        crate::models::Proxy {
            id: "proxy-1".into(),
            name: "Proxy 1".into(),
            protocol: protocol.into(),
            host: "127.0.0.1".into(),
            port: 8080,
            username: Some("user".into()),
            password: Some("pass".into()),
            country: None,
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: None,
            check_message: None,
            last_checked_at: None,
            exit_ip: None,
            latitude: None,
            longitude: None,
            geo_accuracy_meters: None,
            suggested_language: None,
            suggested_timezone: None,
            language_source: None,
            custom_language: None,
            effective_language: None,
            timezone_source: None,
            custom_timezone: None,
            effective_timezone: None,
            target_site_checks: None,
            expires_at: None,
            lifecycle: crate::models::ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        }
    }

    #[test]
    fn captcha_cookie_header_from_cdp_response_builds_header() {
        let value = json!({
            "cookies": [
                { "name": "sid", "value": "abc" },
                { "name": "pref", "value": "zh" },
                { "name": "", "value": "ignored" }
            ]
        });

        assert_eq!(
            captcha_cookie_header_from_cdp_response(&value),
            Some("sid=abc; pref=zh".to_string())
        );
    }

    #[test]
    fn captcha_proxy_config_from_proxy_maps_supported_proxy() {
        let config = captcha_proxy_config_from_proxy(&test_proxy("socks5")).expect("proxy config");

        assert_eq!(config.proxy_type, "socks5");
        assert_eq!(config.proxy_address, "127.0.0.1");
        assert_eq!(config.proxy_port, 8080);
        assert_eq!(config.proxy_login.as_deref(), Some("user"));
        assert_eq!(config.proxy_password.as_deref(), Some("pass"));
    }

    #[test]
    fn captcha_proxy_config_from_proxy_rejects_unsupported_proxy() {
        assert!(captcha_proxy_config_from_proxy(&test_proxy("ssh")).is_none());
    }

    #[tokio::test]
    async fn verify_captcha_resolution_returns_failed_when_page_stays_blocked() {
        let blocked = page_state_json(crate::services::captcha_service::CaptchaPageState {
            url: "https://www.google.com/sorry/index".into(),
            title: "Google Search".into(),
            ready_state: Some("complete".into()),
            challenge_present: true,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec!["google_sorry".into()],
            success_indicators: vec![],
        });
        let (cdp, server) = spawn_mock_cdp_client(vec![blocked]).await;

        let verification = verify_captcha_resolution(&cdp, &injected_token_result())
            .await
            .expect("verify captcha resolution");

        server.abort();
        assert!(!verification.verified);
        assert_eq!(verification.status, "challenge_present");
        assert!(verification
            .blocking_indicators
            .contains(&"google_sorry".to_string()));
    }

    #[tokio::test]
    async fn verify_captcha_resolution_retries_until_page_is_verified() {
        let pending = page_state_json(crate::services::captcha_service::CaptchaPageState {
            url: "https://example.com/login".into(),
            title: "Login".into(),
            ready_state: Some("complete".into()),
            challenge_present: false,
            captcha_widget_present: true,
            token_present: true,
            form_present: true,
            blocking_indicators: vec![],
            success_indicators: vec![],
        });
        let verified = page_state_json(crate::services::captcha_service::CaptchaPageState {
            url: "https://www.google.com/search?q=test".into(),
            title: "test - Google Search".into(),
            ready_state: Some("complete".into()),
            challenge_present: false,
            captcha_widget_present: false,
            token_present: true,
            form_present: true,
            blocking_indicators: vec![],
            success_indicators: vec!["google_search_results_visible".into()],
        });
        let (cdp, server) = spawn_mock_cdp_client(vec![pending, verified]).await;

        let verification = verify_captcha_resolution(&cdp, &injected_token_result())
            .await
            .expect("verify captcha resolution");

        server.abort();
        assert!(verification.verified);
        assert_eq!(verification.status, "verified");
        assert_eq!(
            verification.success_indicators,
            vec!["google_search_results_visible".to_string()]
        );
    }

    #[test]
    fn captcha_verification_diagnostics_marks_user_agent_mismatch() {
        let detect = crate::services::captcha_service::CaptchaDetectResult {
            captcha_type: Some("recaptcha_enterprise".into()),
            sitekey: Some("site-key".into()),
            callback: Some("verifyDone".into()),
            page_action: Some("submit".into()),
            ..Default::default()
        };
        let verification = crate::services::captcha_service::CaptchaVerificationResult {
            verified: false,
            status: "pending_verification".into(),
            message: "已注入 token，但页面还没有出现通过验证的信号".into(),
            ..Default::default()
        };

        let diagnostics = captcha_verification_diagnostics(
            Some(&detect),
            Some(&injected_token_result()),
            &verification,
            Some("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/144.0"),
            Some("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/146.0"),
        );
        let parsed: Value = serde_json::from_str(&diagnostics).expect("parse diagnostics");

        assert_eq!(parsed["captchaType"], "recaptcha_enterprise");
        assert_eq!(parsed["pageAction"], "submit");
        assert_eq!(parsed["userAgentMismatch"], true);
    }
}
