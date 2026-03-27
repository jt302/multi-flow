use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::logger;
use crate::models::{
    AutomationProgressEvent, AutomationRun, AutomationScript, AutomationVariablesUpdatedEvent,
    CreateAutomationScriptRequest, ScriptStep, StepResult,
};
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::state::AppState;

fn error_to_string(err: crate::error::AppError) -> String {
    err.to_string()
}

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
pub async fn run_automation_script(
    app: AppHandle,
    state: State<'_, AppState>,
    script_id: String,
    profile_id: String,
) -> Result<String, String> {
    // 1. Load script & parse steps (drop lock immediately)
    let (steps, steps_json) = {
        let svc = state.lock_automation_service();
        let script = svc.get_script(&script_id).map_err(error_to_string)?;
        let steps_json = serde_json::to_string(&script.steps)
            .map_err(|e| format!("serialize steps failed: {e}"))?;
        (script.steps, steps_json)
    };

    // 2. Resolve ports (drop lock immediately)
    let (debug_port, magic_port) = {
        let em = state.lock_engine_manager();
        match em.get_runtime_handle(&profile_id) {
            Ok(handle) => (handle.debug_port, handle.magic_port),
            Err(_) => (None, None),
        }
    };

    // 3. Create run record (drop lock immediately)
    let run_id = {
        let svc = state.lock_automation_service();
        svc.create_run(&script_id, &profile_id, &steps_json)
            .map_err(error_to_string)?
    };

    // 4. Spawn async executor — fire and forget
    let run_id_clone = run_id.clone();
    tauri::async_runtime::spawn(execute_script(
        app,
        run_id_clone,
        profile_id,
        debug_port,
        magic_port,
        steps,
    ));

    Ok(run_id)
}

async fn execute_script(
    app: AppHandle,
    run_id: String,
    _profile_id: String,
    debug_port: Option<u16>,
    magic_port: Option<u16>,
    steps: Vec<ScriptStep>,
) {
    let step_total = steps.len();
    let cdp = debug_port.map(CdpClient::new);
    let http_client = reqwest::Client::new();
    let mut results: Vec<StepResult> = Vec::with_capacity(step_total);
    let mut vars = RunVariables::new();
    let mut run_failed = false;

    for (index, step) in steps.iter().enumerate() {
        emit_progress(
            &app,
            &run_id,
            index,
            step_total,
            "running",
            None,
            0,
            "running",
            HashMap::new(),
            vec![index],
        );

        let start = Instant::now();
        let result = if run_failed {
            Ok((None, HashMap::new()))
        } else {
            execute_step(cdp.as_ref(), &http_client, magic_port, step, &vars).await
        };
        let duration_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok((output, vars_set)) => {
                // 将本步骤写入的变量存入运行时 vars
                for (k, v) in &vars_set {
                    vars.set(k, v.clone());
                }
                // 变量有变化时发送 variables_updated 事件
                if !vars_set.is_empty() {
                    emit_variables_updated(&app, &run_id, vars.snapshot());
                }

                let step_status = if run_failed { "skipped" } else { "success" };
                results.push(StepResult {
                    index,
                    status: step_status.to_string(),
                    output: output.clone(),
                    duration_ms,
                    vars_set: vars_set.clone(),
                });
                emit_progress(
                    &app,
                    &run_id,
                    index,
                    step_total,
                    step_status,
                    output,
                    duration_ms,
                    "running",
                    vars_set,
                    vec![index],
                );
            }
            Err(err) => {
                run_failed = true;
                results.push(StepResult {
                    index,
                    status: "failed".to_string(),
                    output: Some(err.clone()),
                    duration_ms,
                    vars_set: HashMap::new(),
                });
                emit_progress(
                    &app,
                    &run_id,
                    index,
                    step_total,
                    "failed",
                    Some(err),
                    duration_ms,
                    "running",
                    HashMap::new(),
                    vec![index],
                );
            }
        }

        // Persist incremental results
        persist_run_progress(&app, &run_id, &results, "running", None, None);
    }

    // Finalize
    let final_status = if run_failed { "failed" } else { "success" };
    let error_msg = if run_failed {
        results
            .iter()
            .find(|r| r.status == "failed")
            .and_then(|r| r.output.clone())
    } else {
        None
    };
    let vars_snapshot = vars.snapshot();
    let vars_json = serde_json::to_string(&vars_snapshot).ok();
    persist_run_progress(
        &app,
        &run_id,
        &results,
        final_status,
        error_msg.as_deref(),
        vars_json.as_deref(),
    );
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

/// 执行单个步骤，返回 (output, vars_set)
async fn execute_step(
    cdp: Option<&CdpClient>,
    http_client: &reqwest::Client,
    magic_port: Option<u16>,
    step: &ScriptStep,
    vars: &RunVariables,
) -> Result<(Option<String>, HashMap<String, String>), String> {
    match step {
        ScriptStep::Navigate { url, output_key } => {
            let url = vars.interpolate(url);
            let cdp = cdp.ok_or_else(|| "CDP not available (profile not running)".to_string())?;
            cdp.call("Page.navigate", json!({ "url": url })).await?;
            let mut vars_set = HashMap::new();
            if let Some(key) = output_key {
                vars_set.insert(key.clone(), url.clone());
            }
            Ok((Some(url), vars_set))
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
            let mut vars_set = HashMap::new();
            if let (Some(key), Some(val)) = (result_key, &value) {
                vars_set.insert(key.clone(), val.clone());
            }
            Ok((value, vars_set))
        }
        ScriptStep::Click { selector } => {
            let selector = vars.interpolate(selector);
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let doc = cdp.call("DOM.getDocument", json!({ "depth": 0 })).await?;
            let root_id = doc
                .get("root")
                .and_then(|r| r.get("nodeId"))
                .and_then(|v| v.as_i64())
                .ok_or_else(|| "DOM.getDocument: no root nodeId".to_string())?;
            let qs_result = cdp
                .call(
                    "DOM.querySelector",
                    json!({ "nodeId": root_id, "selector": selector }),
                )
                .await?;
            let node_id = qs_result
                .get("nodeId")
                .and_then(|v| v.as_i64())
                .ok_or_else(|| format!("element not found: {selector}"))?;
            if node_id == 0 {
                return Err(format!("element not found: {selector}"));
            }
            let box_result = cdp
                .call("DOM.getBoxModel", json!({ "nodeId": node_id }))
                .await?;
            let content = box_result
                .get("model")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
                .ok_or_else(|| "getBoxModel: no content".to_string())?;
            let x = (content[0].as_f64().unwrap_or(0.0) + content[2].as_f64().unwrap_or(0.0))
                / 2.0;
            let y = (content[1].as_f64().unwrap_or(0.0) + content[5].as_f64().unwrap_or(0.0))
                / 2.0;
            for event_type in ["mousePressed", "mouseReleased"] {
                cdp.call(
                    "Input.dispatchMouseEvent",
                    json!({ "type": event_type, "x": x, "y": y, "button": "left", "clickCount": 1 }),
                )
                .await?;
            }
            Ok((None, HashMap::new()))
        }
        ScriptStep::Type { selector: _, text } => {
            let text = vars.interpolate(text);
            let port = magic_port.ok_or_else(|| {
                "Magic Controller not available (profile not running)".to_string()
            })?;
            let url = format!("http://127.0.0.1:{port}/");
            http_client
                .post(&url)
                .json(&json!({ "cmd": "type_string", "text": text }))
                .send()
                .await
                .map_err(|e| format!("Magic Controller request failed: {e}"))?;
            Ok((None, HashMap::new()))
        }
        ScriptStep::Screenshot { output_key } => {
            let cdp = cdp.ok_or_else(|| "CDP not available".to_string())?;
            let result = cdp
                .call("Page.captureScreenshot", json!({ "format": "png" }))
                .await?;
            let data = result
                .get("data")
                .and_then(|v| v.as_str())
                .map(|s| format!("data:image/png;base64,{s}"));
            let mut vars_set = HashMap::new();
            if let (Some(key), Some(val)) = (output_key, &data) {
                vars_set.insert(key.clone(), val.clone());
            }
            Ok((data, vars_set))
        }
        ScriptStep::Magic {
            command,
            params,
            output_key,
        } => {
            let command = vars.interpolate(command);
            let params = vars.interpolate_value(params);
            let port = magic_port.ok_or_else(|| {
                "Magic Controller not available (profile not running)".to_string()
            })?;
            let url = format!("http://127.0.0.1:{port}/");
            let mut payload = params.clone();
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("cmd".to_string(), json!(command));
            }
            let resp = http_client
                .post(&url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Magic Controller request failed: {e}"))?;
            let body = resp
                .text()
                .await
                .map_err(|e| format!("Magic Controller read body failed: {e}"))?;
            let mut vars_set = HashMap::new();
            if let Some(key) = output_key {
                vars_set.insert(key.clone(), body.clone());
            }
            Ok((Some(body), vars_set))
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
            let mut vars_set = HashMap::new();
            if let (Some(key), Some(val)) = (output_key, &output) {
                vars_set.insert(key.clone(), val.clone());
            }
            Ok((output, vars_set))
        }
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

fn persist_run_progress(
    app: &AppHandle,
    run_id: &str,
    results: &[StepResult],
    status: &str,
    error: Option<&str>,
    variables_json: Option<&str>,
) {
    let results_json = serde_json::to_string(results).ok();
    let finished_at = if status == "running" {
        None
    } else {
        Some(crate::models::now_ts())
    };
    let state = app.state::<AppState>();
    let update_result = state.lock_automation_service().update_run_status(
        run_id,
        status,
        results_json.as_deref(),
        error,
        finished_at,
        variables_json,
    );
    if let Err(e) = update_result {
        logger::warn(
            "automation",
            format!("persist run progress failed run_id={run_id}: {e}"),
        );
    }
}
