use std::collections::HashMap;
use std::time::{Duration, Instant};

use futures_util::future::BoxFuture;
use futures_util::FutureExt;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::logger;
use crate::models::{
    AutomationHumanDismissedEvent, AutomationHumanRequiredEvent, AutomationProgressEvent,
    AutomationRun, AutomationRunCancelledEvent, AutomationScript, AutomationVariablesUpdatedEvent,
    CreateAutomationScriptRequest, LoopMode, ScriptStep, StepResult, WaitForUserTimeout,
};
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::state::AppState;

fn error_to_string(err: crate::error::AppError) -> String {
    err.to_string()
}

// ─── Tauri 命令 ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_automation_scripts(
    state: State<'_, AppState>,
) -> Result<Vec<AutomationScript>, String> {
    state.lock_automation_service().list_scripts().map_err(error_to_string)
}

#[tauri::command]
pub fn create_automation_script(
    state: State<'_, AppState>,
    payload: CreateAutomationScriptRequest,
) -> Result<AutomationScript, String> {
    state.lock_automation_service().create_script(payload).map_err(error_to_string)
}

#[tauri::command]
pub fn update_automation_script(
    state: State<'_, AppState>,
    script_id: String,
    payload: CreateAutomationScriptRequest,
) -> Result<AutomationScript, String> {
    state.lock_automation_service().update_script(&script_id, payload).map_err(error_to_string)
}

#[tauri::command]
pub fn delete_automation_script(
    state: State<'_, AppState>,
    script_id: String,
) -> Result<(), String> {
    state.lock_automation_service().delete_script(&script_id).map_err(error_to_string)
}

#[tauri::command]
pub fn list_automation_runs(
    state: State<'_, AppState>,
    script_id: String,
) -> Result<Vec<AutomationRun>, String> {
    state.lock_automation_service().list_runs(&script_id).map_err(error_to_string)
}

#[tauri::command]
pub async fn run_automation_script(
    app: AppHandle,
    state: State<'_, AppState>,
    script_id: String,
    profile_id: String,
) -> Result<String, String> {
    let (steps, steps_json) = {
        let svc = state.lock_automation_service();
        let script = svc.get_script(&script_id).map_err(error_to_string)?;
        let steps_json = serde_json::to_string(&script.steps)
            .map_err(|e| format!("serialize steps failed: {e}"))?;
        (script.steps, steps_json)
    };
    let (debug_port, magic_port) = {
        let em = state.lock_engine_manager();
        match em.get_runtime_handle(&profile_id) {
            Ok(handle) => (handle.debug_port, handle.magic_port),
            Err(_) => (None, None),
        }
    };
    let run_id = {
        let svc = state.lock_automation_service();
        svc.create_run(&script_id, &profile_id, &steps_json).map_err(error_to_string)?
    };
    tauri::async_runtime::spawn(execute_script(app, run_id.clone(), debug_port, magic_port, steps));
    Ok(run_id)
}

#[tauri::command]
pub async fn resume_automation_run(
    state: State<'_, AppState>,
    run_id: String,
    input: Option<String>,
) -> Result<(), String> {
    let sender = state
        .active_run_channels.lock().map_err(|_| "lock poisoned".to_string())?
        .remove(&run_id);
    match sender {
        Some(tx) => { let _ = tx.send(input); Ok(()) }
        None => Err(format!("no waiting run: {run_id}")),
    }
}

#[tauri::command]
pub async fn cancel_automation_run(
    app: AppHandle,
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), String> {
    state.cancel_tokens.lock().map_err(|_| "lock poisoned".to_string())?
        .insert(run_id.clone(), true);
    if let Ok(mut channels) = state.active_run_channels.lock() {
        if let Some(tx) = channels.remove(&run_id) { let _ = tx.send(None); }
    }
    let _ = app.emit("automation_run_cancelled", AutomationRunCancelledEvent { run_id });
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
    debug_port: Option<u16>,
    magic_port: Option<u16>,
    steps: Vec<ScriptStep>,
) {
    let step_total = steps.len();
    let cdp = debug_port.map(CdpClient::new);
    let http_client = reqwest::Client::new();
    let mut results: Vec<StepResult> = Vec::with_capacity(step_total);
    let mut vars = RunVariables::new();

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
        FlowSignal::Error(msg) if msg != "cancelled" => {
            results.iter().find(|r| r.status == "failed")
                .and_then(|r| r.output.clone())
                .or_else(|| Some(msg.clone()))
        }
        _ => None,
    };
    let vars_json = serde_json::to_string(&vars.snapshot()).ok();
    persist_run_progress(&app, &run_id, &results, final_status, error_msg.as_deref(), vars_json.as_deref());
    emit_progress(&app, &run_id, step_total.saturating_sub(1), step_total, final_status, None, 0, final_status, HashMap::new(), vec![]);
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
) -> BoxFuture<'a, FlowSignal> {
    Box::pin(async move {
        for (index, step) in steps.into_iter().enumerate() {
            if is_cancelled(app, run_id) {
                return FlowSignal::Error("cancelled".to_string());
            }

            let mut step_path = path_prefix.clone();
            step_path.push(index);
            let top_index = path_prefix.first().copied().unwrap_or(index);

            emit_progress(app, run_id, top_index, step_total, "running", None, 0, "running",
                HashMap::new(), step_path.clone());

            let start = Instant::now();

            match &step {
                ScriptStep::Break => return FlowSignal::Break,
                ScriptStep::Continue => return FlowSignal::Continue,

                ScriptStep::Condition { condition_expr, then_steps, else_steps } => {
                    let expr = vars.interpolate(condition_expr);
                    let is_true = vars.eval_condition(&expr);
                    let branch = if is_true { then_steps.clone() } else { else_steps.clone() };
                    let signal = execute_steps(branch, step_path.clone(), step_total, cdp,
                        http_client, magic_port, app, run_id, results, vars).await;
                    match signal {
                        FlowSignal::Normal | FlowSignal::Continue => {}
                        FlowSignal::Break | FlowSignal::Error(_) => return signal,
                    }
                    let dur = start.elapsed().as_millis() as u64;
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: Some(format!("condition={expr}, branch={}", if is_true { "then" } else { "else" })),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    continue;
                }

                ScriptStep::Loop { mode, count, condition_expr, max_iterations, iter_var, body_steps } => {
                    let max = max_iterations.unwrap_or(u64::MAX);
                    let mut iteration: u64 = 0;
                    loop {
                        if iteration >= max { break; }
                        let should_run = match mode {
                            LoopMode::Count => iteration < count.unwrap_or(1),
                            LoopMode::While => condition_expr.as_ref()
                                .map(|e| vars.eval_condition(&vars.interpolate(e)))
                                .unwrap_or(false),
                        };
                        if !should_run { break; }
                        if let Some(key) = iter_var {
                            vars.set(key, iteration.to_string());
                        }
                        let mut iter_path = step_path.clone();
                        iter_path.push(iteration as usize);
                        let signal = execute_steps(body_steps.clone(), iter_path, step_total, cdp,
                            http_client, magic_port, app, run_id, results, vars).await;
                        match signal {
                            FlowSignal::Break => break,
                            FlowSignal::Error(e) => return FlowSignal::Error(e),
                            _ => {}
                        }
                        iteration += 1;
                    }
                    let dur = start.elapsed().as_millis() as u64;
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: Some(format!("iterations={iteration}")),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    continue;
                }

                _ => {} // 普通步骤走通用路径
            }

            // 普通步骤
            let result = execute_step(cdp, http_client, magic_port, &step, vars, app, run_id, top_index).await;
            let dur = start.elapsed().as_millis() as u64;

            if is_cancelled(app, run_id) {
                return FlowSignal::Error("cancelled".to_string());
            }

            match result {
                Ok((output, vars_set)) => {
                    for (k, v) in &vars_set { vars.set(k, v.clone()); }
                    if !vars_set.is_empty() { emit_variables_updated(app, run_id, vars.snapshot()); }
                    results.push(StepResult {
                        index: top_index,
                        status: "success".to_string(),
                        output: output.clone(),
                        duration_ms: dur,
                        vars_set: vars_set.clone(),
                    });
                    emit_progress(app, run_id, top_index, step_total, "success", output, dur, "running", vars_set, step_path);
                    if path_prefix.is_empty() {
                        persist_run_progress(app, run_id, results, "running", None, None);
                    }
                }
                Err(err) => {
                    results.push(StepResult {
                        index: top_index,
                        status: "failed".to_string(),
                        output: Some(err.clone()),
                        duration_ms: dur,
                        vars_set: HashMap::new(),
                    });
                    emit_progress(app, run_id, top_index, step_total, "failed", Some(err.clone()), dur, "running", HashMap::new(), step_path);
                    persist_run_progress(app, run_id, results, "running", None, None);
                    return FlowSignal::Error(err);
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
) -> Result<(Option<String>, HashMap<String, String>), String> {
    match step {
        ScriptStep::Navigate { url, output_key } => {
            let url = vars.interpolate(url);
            let cdp = cdp.ok_or_else(|| "CDP not available (profile not running)".to_string())?;
            cdp.call("Page.navigate", json!({ "url": url })).await?;
            let mut vs = HashMap::new();
            if let Some(k) = output_key { vs.insert(k.clone(), url.clone()); }
            Ok((Some(url), vs))
        }
        ScriptStep::Wait { ms } => {
            tokio::time::sleep(Duration::from_millis(*ms)).await;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Evaluate { expression, result_key } => {
            let expression = vars.interpolate(expression);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call("Runtime.evaluate",
                json!({ "expression": expression, "returnByValue": true })).await?;
            let value = result.get("result").and_then(|r| r.get("value")).map(|v| v.to_string());
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (result_key, &value) { vs.insert(k.clone(), v.clone()); }
            Ok((value, vs))
        }
        ScriptStep::Click { selector } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let doc = cdp.call("DOM.getDocument", json!({ "depth": 0 })).await?;
            let root_id = doc.get("root").and_then(|r| r.get("nodeId")).and_then(|v| v.as_i64())
                .ok_or_else(|| "DOM.getDocument: no root nodeId".to_string())?;
            let qs = cdp.call("DOM.querySelector", json!({ "nodeId": root_id, "selector": selector })).await?;
            let node_id = qs.get("nodeId").and_then(|v| v.as_i64())
                .ok_or_else(|| format!("element not found: {selector}"))?;
            if node_id == 0 { return Err(format!("element not found: {selector}")); }
            let bm = cdp.call("DOM.getBoxModel", json!({ "nodeId": node_id })).await?;
            let content = bm.get("model").and_then(|m| m.get("content")).and_then(|c| c.as_array())
                .ok_or_else(|| "getBoxModel: no content".to_string())?;
            let x = (content[0].as_f64().unwrap_or(0.0) + content[2].as_f64().unwrap_or(0.0)) / 2.0;
            let y = (content[1].as_f64().unwrap_or(0.0) + content[5].as_f64().unwrap_or(0.0)) / 2.0;
            for ev in ["mousePressed", "mouseReleased"] {
                cdp.call("Input.dispatchMouseEvent",
                    json!({ "type": ev, "x": x, "y": y, "button": "left", "clickCount": 1 })).await?;
            }
            Ok((None, HashMap::new()))
        }
        ScriptStep::Type { selector: _, text } => {
            let text = vars.interpolate(text);
            let port = magic_port.ok_or_else(|| "Magic Controller not available".to_string())?;
            http_client.post(format!("http://127.0.0.1:{port}/"))
                .json(&json!({ "cmd": "type_string", "text": text }))
                .send().await.map_err(|e| format!("Magic request failed: {e}"))?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Screenshot { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call("Page.captureScreenshot", json!({ "format": "png" })).await?;
            let data = result.get("data").and_then(|v| v.as_str())
                .map(|s| format!("data:image/png;base64,{s}"));
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &data) { vs.insert(k.clone(), v.clone()); }
            Ok((data, vs))
        }
        ScriptStep::Magic { command, params, output_key } => {
            let command = vars.interpolate(command);
            let params = vars.interpolate_value(params);
            let port = magic_port.ok_or_else(|| "Magic Controller not available".to_string())?;
            let mut payload = params.clone();
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("cmd".to_string(), json!(command));
            }
            let resp = http_client.post(format!("http://127.0.0.1:{port}/"))
                .json(&payload).send().await.map_err(|e| format!("Magic request failed: {e}"))?;
            let body = resp.text().await.map_err(|e| format!("Magic read body failed: {e}"))?;
            let mut vs = HashMap::new();
            if let Some(k) = output_key { vs.insert(k.clone(), body.clone()); }
            Ok((Some(body), vs))
        }
        ScriptStep::Cdp { method, params, output_key } => {
            let method = vars.interpolate(method);
            let params = params.as_ref().map(|p| vars.interpolate_value(p)).unwrap_or(json!({}));
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp.call(&method, params).await?;
            let output = Some(result.to_string());
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &output) { vs.insert(k.clone(), v.clone()); }
            Ok((output, vs))
        }
        ScriptStep::WaitForUser { message, input_label, output_key, timeout_ms, on_timeout } => {
            let message = vars.interpolate(message);
            let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
            {
                let app_state = app.state::<AppState>();
                let mut guard = app_state.active_run_channels.lock().unwrap_or_else(|e| e.into_inner());
                guard.insert(run_id.to_string(), tx);
            }
            let _ = app.emit("automation_human_required", AutomationHumanRequiredEvent {
                run_id: run_id.to_string(),
                message: message.clone(),
                input_label: input_label.clone(),
                timeout_ms: *timeout_ms,
                step_path: vec![step_index],
            });
            let user_input = if let Some(ms) = timeout_ms {
                match tokio::time::timeout(Duration::from_millis(*ms), rx).await {
                    Ok(Ok(input)) => input,
                    Ok(Err(_)) => None,
                    Err(_) => {
                        {
                            let app_state = app.state::<AppState>();
                            app_state.active_run_channels.lock().unwrap_or_else(|e| e.into_inner()).remove(run_id);
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
                match rx.await { Ok(input) => input, Err(_) => None }
            };
            emit_human_dismissed(app, run_id);
            if user_input.is_none() && is_cancelled(app, run_id) {
                return Err("cancelled".to_string());
            }
            let mut vs = HashMap::new();
            if let (Some(k), Some(v)) = (output_key, &user_input) { vs.insert(k.clone(), v.clone()); }
            let output = user_input.map(|s| if s.is_empty() { "(timeout)".to_string() } else { s });
            Ok((output, vs))
        }
        ScriptStep::Condition { .. } | ScriptStep::Loop { .. } | ScriptStep::Break | ScriptStep::Continue => {
            Err("control flow step executed outside execute_steps context".to_string())
        }
    }
}

fn is_cancelled(app: &AppHandle, run_id: &str) -> bool {
    app.state::<AppState>().cancel_tokens.lock()
        .map(|tokens| tokens.get(run_id).copied().unwrap_or(false))
        .unwrap_or(false)
}

// ─── 事件工具函数 ──────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app: &AppHandle, run_id: &str, step_index: usize, step_total: usize,
    step_status: &str, output: Option<String>, duration_ms: u64, run_status: &str,
    vars_set: HashMap<String, String>, step_path: Vec<usize>,
) {
    let event = AutomationProgressEvent {
        run_id: run_id.to_string(), step_index, step_total,
        step_status: step_status.to_string(), output, duration_ms,
        run_status: run_status.to_string(), vars_set, step_path,
    };
    if let Err(e) = app.emit("automation_progress", &event) {
        logger::warn("automation", format!("emit progress failed: {e}"));
    }
}

fn emit_variables_updated(app: &AppHandle, run_id: &str, vars: HashMap<String, String>) {
    let event = AutomationVariablesUpdatedEvent { run_id: run_id.to_string(), vars };
    if let Err(e) = app.emit("automation_variables_updated", &event) {
        logger::warn("automation", format!("emit variables_updated failed: {e}"));
    }
}

fn emit_human_dismissed(app: &AppHandle, run_id: &str) {
    let _ = app.emit("automation_human_dismissed",
        AutomationHumanDismissedEvent { run_id: run_id.to_string() });
}

fn persist_run_progress(
    app: &AppHandle, run_id: &str, results: &[StepResult],
    status: &str, error: Option<&str>, variables_json: Option<&str>,
) {
    let results_json = serde_json::to_string(results).ok();
    let finished_at = if status == "running" { None } else { Some(crate::models::now_ts()) };
    let state = app.state::<AppState>();
    let result = state.lock_automation_service().update_run_status(
        run_id, status, results_json.as_deref(), error, finished_at, variables_json,
    );
    if let Err(e) = result {
        logger::warn("automation", format!("persist run progress failed run_id={run_id}: {e}"));
    }
}
