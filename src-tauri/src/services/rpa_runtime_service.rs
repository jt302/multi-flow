use std::collections::HashMap;
use std::thread;
use std::time::Duration;

use chromiumoxide::browser::Browser;
use chromiumoxide::page::ScreenshotParams;
use chromiumoxide_cdp::cdp::browser_protocol::page::CaptureScreenshotFormat;
use futures_util::stream::{self, StreamExt};
use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::profile_commands::{do_close_profile, do_open_profile};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, OpenProfileOptions, RpaArtifactIndex, RpaFlowDefinition, RpaFlowNode, RpaRunInstance,
    RpaRunInstanceStatus, RpaRunStepStatus,
};
use crate::services::rpa_run_service::{NewRpaRunStep, RpaRunService};
use crate::state::AppState;

const RUN_UPDATED_EVENT: &str = "rpa:run-updated";
const INSTANCE_UPDATED_EVENT: &str = "rpa:instance-updated";
const STEP_APPENDED_EVENT: &str = "rpa:step-appended";

pub struct RpaRuntimeService;

impl RpaRuntimeService {
    pub fn spawn_run(app: AppHandle, run_id: String) {
        tauri::async_runtime::spawn(async move {
            let _ = Self::process_run(app, run_id).await;
        });
    }

    pub fn spawn_resume_instance(app: AppHandle, instance_id: String) {
        tauri::async_runtime::spawn(async move {
            let _ = Self::process_resumed_instance(app, instance_id).await;
        });
    }

    async fn process_run(app: AppHandle, run_id: String) -> AppResult<()> {
        let state = app.state::<AppState>();
        {
            let run_service = lock_run_service(&state)?;
            let run = run_service.mark_run_started(&run_id)?;
            let _ = app.emit(RUN_UPDATED_EVENT, &run);
        }

        let details = {
            let run_service = lock_run_service(&state)?;
            run_service
                .get_run_details(&run_id)?
                .ok_or_else(|| AppError::NotFound(format!("rpa run not found: {run_id}")))?
        };
        let concurrency_limit = details.run.concurrency_limit as usize;
        let definition = details.run.definition_snapshot.clone();
        let instances = details
            .instances
            .into_iter()
            .filter(|item| item.status == RpaRunInstanceStatus::Queued)
            .collect::<Vec<_>>();

        stream::iter(instances)
            .for_each_concurrent(concurrency_limit, |instance| {
                let app = app.clone();
                let definition = definition.clone();
                async move {
                    let _ = Self::process_instance(app, definition, instance, false).await;
                }
            })
            .await;

        let state = app.state::<AppState>();
        let run_service = lock_run_service(&state)?;
        let run = run_service.update_run_aggregate_status(&run_id)?;
        let _ = app.emit(RUN_UPDATED_EVENT, &run);
        Ok(())
    }

    async fn process_resumed_instance(app: AppHandle, instance_id: String) -> AppResult<()> {
        let state = app.state::<AppState>();
        let details = {
            let run_service = lock_run_service(&state)?;
            let instance = run_service.get_instance(&instance_id)?;
            if instance.status != RpaRunInstanceStatus::NeedsManual {
                return Err(AppError::Conflict(format!(
                    "rpa run instance is not waiting for manual continue: {instance_id}"
                )));
            }
            let run_id = instance.run_id.clone();
            let details = run_service
                .get_run_details(&run_id)?
                .ok_or_else(|| AppError::NotFound(format!("rpa run not found: {run_id}")))?;
            let run = run_service.mark_run_started(&run_id)?;
            let _ = app.emit(RUN_UPDATED_EVENT, &run);
            details
        };
        let instance = details
            .instances
            .into_iter()
            .find(|item| item.id == instance_id)
            .ok_or_else(|| AppError::NotFound(format!("rpa run instance not found: {instance_id}")))?;
        Self::process_instance(app.clone(), details.run.definition_snapshot, instance, true).await?;
        let state = app.state::<AppState>();
        let run_service = lock_run_service(&state)?;
        let run = run_service.update_run_aggregate_status(&details.run.id)?;
        let _ = app.emit(RUN_UPDATED_EVENT, &run);
        Ok(())
    }

    async fn process_instance(
        app: AppHandle,
        definition: RpaFlowDefinition,
        mut instance: RpaRunInstance,
        resume_manual: bool,
    ) -> AppResult<()> {
        let mut context = instance.context.clone();
        let node_map = definition
            .nodes
            .iter()
            .map(|item| (item.id.as_str(), item))
            .collect::<HashMap<_, _>>();
        let state = app.state::<AppState>();
        {
            let run_service = lock_run_service(&state)?;
            instance = run_service.mark_instance_running(&instance.id, instance.current_node_id.clone())?;
            let _ = app.emit(INSTANCE_UPDATED_EVENT, &instance);
        }

        let mut current_node_id = instance.current_node_id.clone();
        let mut skip_manual_gate = resume_manual;
        loop {
            let Some(node_id) = current_node_id.clone() else {
                let state = app.state::<AppState>();
                let run_service = lock_run_service(&state)?;
                let updated =
                    run_service.mark_instance_success(&instance.id, None, context.clone())?;
                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                return Ok(());
            };
            let Some(node) = node_map.get(node_id.as_str()) else {
                let state = app.state::<AppState>();
                let run_service = lock_run_service(&state)?;
                let updated = run_service.mark_instance_failed(
                    &instance.id,
                    Some(node_id.clone()),
                    context.clone(),
                    format!("node not found: {node_id}"),
                )?;
                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                return Ok(());
            };

            let retry_count = node.config.get_u64("retryCount").unwrap_or(0) as u32;
            let mut last_error: Option<String> = None;
            let mut handled = false;
            for attempt in 1..=retry_count.saturating_add(1) {
                match Self::execute_node(
                    &app,
                    &instance,
                    node,
                    &definition,
                    &mut context,
                    skip_manual_gate,
                )
                .await
                {
                    Ok(outcome) => {
                        skip_manual_gate = false;
                        handled = true;
                        let state = app.state::<AppState>();
                        let run_service = lock_run_service(&state)?;
                        let step = run_service.append_step(NewRpaRunStep {
                            run_instance_id: instance.id.clone(),
                            node_id: node.id.clone(),
                            node_kind: node.kind.clone(),
                            status: if outcome.skipped {
                                RpaRunStepStatus::Skipped
                            } else {
                                RpaRunStepStatus::Success
                            },
                            attempt,
                            input_snapshot: build_input_snapshot(node, &context),
                            output_snapshot: outcome.output.clone(),
                            error_message: None,
                            artifacts: outcome.artifacts.clone(),
                            started_at: outcome.started_at,
                            finished_at: Some(now_ts()),
                        })?;
                        let _ = app.emit(STEP_APPENDED_EVENT, &step);

                        match outcome.kind {
                            NodeOutcomeKind::Continue(handle) => {
                                current_node_id = resolve_next_node_id(&definition, &node.id, handle);
                                let updated = run_service.update_instance_context(
                                    &instance.id,
                                    current_node_id.clone(),
                                    context.clone(),
                                )?;
                                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                            }
                            NodeOutcomeKind::Manual => {
                                let updated =
                                    run_service.mark_instance_manual(&instance.id, node.id.clone())?;
                                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                                return Ok(());
                            }
                            NodeOutcomeKind::SuccessEnd => {
                                let updated = run_service.mark_instance_success(
                                    &instance.id,
                                    None,
                                    context.clone(),
                                )?;
                                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                                return Ok(());
                            }
                            NodeOutcomeKind::FailureEnd(message) => {
                                let updated = run_service.mark_instance_failed(
                                    &instance.id,
                                    Some(node.id.clone()),
                                    context.clone(),
                                    message,
                                )?;
                                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                                return Ok(());
                            }
                        }
                        break;
                    }
                    Err(err) => {
                        last_error = Some(err.to_string());
                        let state = app.state::<AppState>();
                        let run_service = lock_run_service(&state)?;
                        let step = run_service.append_step(NewRpaRunStep {
                            run_instance_id: instance.id.clone(),
                            node_id: node.id.clone(),
                            node_kind: node.kind.clone(),
                            status: RpaRunStepStatus::Failed,
                            attempt,
                            input_snapshot: build_input_snapshot(node, &context),
                            output_snapshot: Map::new(),
                            error_message: Some(err.to_string()),
                            artifacts: RpaArtifactIndex::default(),
                            started_at: now_ts(),
                            finished_at: Some(now_ts()),
                        })?;
                        let _ = app.emit(STEP_APPENDED_EVENT, &step);
                    }
                }
            }

            if !handled {
                let state = app.state::<AppState>();
                let run_service = lock_run_service(&state)?;
                let updated = run_service.mark_instance_failed(
                    &instance.id,
                    Some(node.id.clone()),
                    context.clone(),
                    last_error.unwrap_or_else(|| "node execution failed".to_string()),
                )?;
                let _ = app.emit(INSTANCE_UPDATED_EVENT, &updated);
                return Ok(());
            }
        }
    }

    async fn execute_node(
        app: &AppHandle,
        instance: &RpaRunInstance,
        node: &RpaFlowNode,
        definition: &RpaFlowDefinition,
        context: &mut Map<String, Value>,
        skip_manual_gate: bool,
    ) -> AppResult<NodeOutcome> {
        let started_at = now_ts();
        let mut output = Map::new();
        let mut artifacts = RpaArtifactIndex::default();
        let outcome_kind = match node.kind.as_str() {
            "open_profile" => {
                let state = app.state::<AppState>();
                let _ = do_open_profile(
                    &state,
                    Some(app),
                    None,
                    &instance.profile_id,
                    Some(OpenProfileOptions::default()),
                )
                .map_err(AppError::Validation)?;
                NodeOutcomeKind::Continue("success")
            }
            "close_profile" => {
                let state = app.state::<AppState>();
                let _ =
                    do_close_profile(&state, &instance.profile_id).map_err(AppError::Validation)?;
                NodeOutcomeKind::Continue("success")
            }
            "delay" => {
                let ms = node.config.get_u64("durationMs").unwrap_or(500);
                thread::sleep(Duration::from_millis(ms));
                NodeOutcomeKind::Continue("success")
            }
            "open_tab" => {
                let url = render_template(node.config.get_str("url").as_deref(), context)?;
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.open_tab(&instance.profile_id, Some(url))?;
                NodeOutcomeKind::Continue("success")
            }
            "open_window" => {
                let url = render_template(node.config.get_str("url").as_deref(), context)?;
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.open_window(&instance.profile_id, Some(url))?;
                NodeOutcomeKind::Continue("success")
            }
            "close_tab" => {
                let tab_id = node.config.get_u64("tabId");
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.close_tab(&instance.profile_id, tab_id)?;
                NodeOutcomeKind::Continue("success")
            }
            "close_inactive_tabs" => {
                let window_id = node.config.get_u64("windowId");
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.close_inactive_tabs(&instance.profile_id, window_id)?;
                NodeOutcomeKind::Continue("success")
            }
            "focus_window" => {
                let window_id = node.config.get_u64("windowId");
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.focus_window(&instance.profile_id, window_id)?;
                NodeOutcomeKind::Continue("success")
            }
            "activate_tab" => {
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                if let Some(tab_id) = node.config.get_u64("tabId") {
                    let _ = engine_manager.activate_tab(&instance.profile_id, tab_id)?;
                } else {
                    let index = node.config.get_u64("index").unwrap_or(0) as usize;
                    let window_id = node.config.get_u64("windowId");
                    let _ =
                        engine_manager.activate_tab_by_index(&instance.profile_id, index, window_id)?;
                }
                NodeOutcomeKind::Continue("success")
            }
            "set_window_bounds" => {
                let state = app.state::<AppState>();
                let mut engine_manager = state
                    .engine_manager
                    .lock()
                    .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
                let _ = engine_manager.set_window_bounds(
                    &instance.profile_id,
                    crate::models::WindowBounds {
                        x: node.config.get_i64("x").unwrap_or_default() as i32,
                        y: node.config.get_i64("y").unwrap_or_default() as i32,
                        width: node.config.get_i64("width").unwrap_or(1280) as i32,
                        height: node.config.get_i64("height").unwrap_or(900) as i32,
                    },
                    node.config.get_u64("windowId"),
                )?;
                NodeOutcomeKind::Continue("success")
            }
            "goto_url" => {
                let url = render_template(node.config.get_str("url").as_deref(), context)?;
                with_profile_page(app, &instance.profile_id, |page| async move {
                    let _ = page.goto(&url).await.map_err(map_cdp_error)?;
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "wait_for_selector" => {
                let selector = require_config_value(node, "selector")?;
                let selector = render_template(Some(&selector), context)?;
                let timeout_ms = node.config.get_u64("timeoutMs").unwrap_or(5_000);
                with_profile_page(app, &instance.profile_id, |page| async move {
                    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
                    loop {
                        if page.find_element(&selector).await.is_ok() {
                            break;
                        }
                        if std::time::Instant::now() >= deadline {
                            return Err(AppError::Validation(format!(
                                "selector not found before timeout: {selector}"
                            )));
                        }
                        thread::sleep(Duration::from_millis(200));
                    }
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "click_element" => {
                let selector = render_template(Some(&require_config_value(node, "selector")?), context)?;
                with_profile_page(app, &instance.profile_id, |page| async move {
                    page.find_element(&selector)
                        .await
                        .map_err(map_cdp_error)?
                        .click()
                        .await
                        .map_err(map_cdp_error)?;
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "input_text" => {
                let selector = render_template(Some(&require_config_value(node, "selector")?), context)?;
                let text = render_template(node.config.get_str("text").as_deref(), context)?;
                with_profile_page(app, &instance.profile_id, |page| async move {
                    page.find_element(&selector)
                        .await
                        .map_err(map_cdp_error)?
                        .click()
                        .await
                        .map_err(map_cdp_error)?
                        .type_str(&text)
                        .await
                        .map_err(map_cdp_error)?;
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "press_key" => {
                let key = render_template(node.config.get_str("key").as_deref(), context)?;
                with_profile_page(app, &instance.profile_id, |page| async move {
                    let body = page.find_element("body").await.map_err(map_cdp_error)?;
                    body.press_key(&key).await.map_err(map_cdp_error)?;
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "scroll_to" => {
                let selector = node.config.get_str("selector");
                with_profile_page(app, &instance.profile_id, |page| async move {
                    if let Some(selector) = selector {
                        let script = format!(
                            "const el = document.querySelector({}); if (el) {{ el.scrollIntoView({{behavior:'auto', block:'center'}}); true; }} else {{ false; }}",
                            serde_json::to_string(&selector).unwrap_or_else(|_| "\"\"".to_string())
                        );
                        let found = page
                            .evaluate(script.as_str())
                            .await
                            .map_err(map_cdp_error)?
                            .into_value::<bool>()?;
                        if !found {
                            return Err(AppError::Validation(format!(
                                "selector not found for scroll: {selector}"
                            )));
                        }
                    } else {
                        let x = node.config.get_i64("x").unwrap_or_default();
                        let y = node.config.get_i64("y").unwrap_or_default();
                        let script = format!("window.scrollTo({}, {}); true;", x, y);
                        let _ = page.evaluate(script.as_str()).await.map_err(map_cdp_error)?;
                    }
                    Ok(Map::new())
                })
                .await?;
                NodeOutcomeKind::Continue("success")
            }
            "execute_js" => {
                let script = render_template(node.config.get_str("script").as_deref(), context)?;
                let variable_key = node.config.get_str("variableKey");
                let result = with_profile_page(app, &instance.profile_id, |page| async move {
                    let value = page
                        .evaluate(script.as_str())
                        .await
                        .map_err(map_cdp_error)?
                        .into_value::<Value>()?;
                    let mut output = Map::new();
                    output.insert("result".to_string(), value);
                    Ok(output)
                })
                .await?;
                output.extend(result.clone());
                if let Some(variable_key) = variable_key {
                    if let Some(value) = result.get("result") {
                        context.insert(variable_key, value.clone());
                    }
                }
                NodeOutcomeKind::Continue("success")
            }
            "extract_text" => {
                let selector = render_template(Some(&require_config_value(node, "selector")?), context)?;
                let variable_key = require_config_value(node, "variableKey")?;
                let result = with_profile_page(app, &instance.profile_id, |page| async move {
                    let text = page
                        .find_element(&selector)
                        .await
                        .map_err(map_cdp_error)?
                        .inner_text()
                        .await
                        .map_err(map_cdp_error)?
                        .unwrap_or_default();
                    let mut output = Map::new();
                    output.insert("text".to_string(), Value::String(text));
                    Ok(output)
                })
                .await?;
                if let Some(value) = result.get("text") {
                    context.insert(variable_key, value.clone());
                }
                output.extend(result);
                NodeOutcomeKind::Continue("success")
            }
            "extract_attribute" => {
                let selector = render_template(Some(&require_config_value(node, "selector")?), context)?;
                let attribute = require_config_value(node, "attribute")?;
                let variable_key = require_config_value(node, "variableKey")?;
                let result = with_profile_page(app, &instance.profile_id, |page| async move {
                    let value = page
                        .find_element(&selector)
                        .await
                        .map_err(map_cdp_error)?
                        .attribute(&attribute)
                        .await
                        .map_err(map_cdp_error)?
                        .unwrap_or_default();
                    let mut output = Map::new();
                    output.insert("value".to_string(), Value::String(value));
                    Ok(output)
                })
                .await?;
                if let Some(value) = result.get("value") {
                    context.insert(variable_key, value.clone());
                }
                output.extend(result);
                NodeOutcomeKind::Continue("success")
            }
            "screenshot_page" => {
                let file_name = node
                    .config
                    .get_str("fileName")
                    .unwrap_or_else(|| "page.png".to_string());
                let bytes = with_profile_page(app, &instance.profile_id, |page| async move {
                    let content = page
                        .screenshot(
                            ScreenshotParams::builder()
                                .format(CaptureScreenshotFormat::Png)
                                .full_page(true)
                                .build(),
                        )
                        .await
                        .map_err(map_cdp_error)?;
                    let mut output = Map::new();
                    output.insert("size".to_string(), Value::Number((content.len() as u64).into()));
                    Ok((output, content))
                })
                .await?;
                let state = app.state::<AppState>();
                let artifact_service = lock_artifact_service(&state)?;
                let step_id = format!("{}_{}", node.id, started_at);
                let path = artifact_service.write_bytes(
                    &instance.run_id,
                    &instance.id,
                    &step_id,
                    &file_name,
                    &bytes.1,
                )?;
                artifacts.screenshot_path = Some(path);
                output.extend(bytes.0);
                NodeOutcomeKind::Continue("success")
            }
            "set_variable" => {
                let key = require_config_value(node, "key")?;
                let value = render_template(node.config.get_str("value").as_deref(), context)?;
                context.insert(key, Value::String(value));
                NodeOutcomeKind::Continue("success")
            }
            "branch" => {
                let variable_key = require_config_value(node, "variableKey")?;
                let operator = node
                    .config
                    .get_str("operator")
                    .unwrap_or_else(|| "equals".to_string());
                let right = render_template(node.config.get_str("value").as_deref(), context)?;
                let left = context
                    .get(&variable_key)
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                let matched = match operator.as_str() {
                    "not_equals" => left != right,
                    "contains" => left.contains(&right),
                    "exists" => context.contains_key(&variable_key),
                    _ => left == right,
                };
                output.insert("matched".to_string(), Value::Bool(matched));
                NodeOutcomeKind::Continue(if matched { "true" } else { "false" })
            }
            "manual_gate" => {
                if skip_manual_gate {
                    NodeOutcomeKind::Continue("success")
                } else {
                    NodeOutcomeKind::Manual
                }
            }
            "failure_end" => NodeOutcomeKind::FailureEnd(
                node.config
                    .get_str("message")
                    .unwrap_or_else(|| "flow terminated by failure_end".to_string()),
            ),
            "success_end" => NodeOutcomeKind::SuccessEnd,
            other => {
                return Err(AppError::Validation(format!(
                    "unsupported rpa node kind: {other}"
                )))
            }
        };

        let _ = definition;
        Ok(NodeOutcome {
            kind: outcome_kind,
            output,
            artifacts,
            started_at,
            skipped: skip_manual_gate && node.kind == "manual_gate",
        })
    }
}

#[derive(Debug)]
struct NodeOutcome {
    kind: NodeOutcomeKind,
    output: Map<String, Value>,
    artifacts: RpaArtifactIndex,
    started_at: i64,
    skipped: bool,
}

#[derive(Debug)]
enum NodeOutcomeKind {
    Continue(&'static str),
    Manual,
    SuccessEnd,
    FailureEnd(String),
}

fn build_input_snapshot(node: &RpaFlowNode, context: &Map<String, Value>) -> Map<String, Value> {
    let mut snapshot = Map::new();
    snapshot.insert("config".to_string(), serde_json::to_value(&node.config.0).unwrap_or(Value::Null));
    snapshot.insert("context".to_string(), Value::Object(context.clone()));
    snapshot
}

fn resolve_next_node_id(
    definition: &RpaFlowDefinition,
    node_id: &str,
    handle: &'static str,
) -> Option<String> {
    definition
        .edges
        .iter()
        .find(|edge| edge.source == node_id && edge.source_handle.as_deref().unwrap_or("success") == handle)
        .map(|edge| edge.target.clone())
        .or_else(|| {
            definition
                .edges
                .iter()
                .find(|edge| edge.source == node_id)
                .map(|edge| edge.target.clone())
        })
}

fn require_config_value(node: &RpaFlowNode, key: &str) -> AppResult<String> {
    node.config
        .get_str(key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::Validation(format!("node {} missing config key: {key}", node.id)))
}

fn render_template(template: Option<&str>, context: &Map<String, Value>) -> AppResult<String> {
    let Some(template) = template else {
        return Ok(String::new());
    };
    let mut output = template.to_string();
    for (key, value) in context {
        let replacement = match value {
            Value::String(value) => value.clone(),
            _ => value.to_string(),
        };
        output = output.replace(&format!("{{{{{key}}}}}"), &replacement);
    }
    Ok(output)
}

fn lock_run_service<'a>(
    state: &'a AppState,
) -> AppResult<std::sync::MutexGuard<'a, RpaRunService>> {
    state
        .rpa_run_service
        .lock()
        .map_err(|_| AppError::Validation("rpa run service lock poisoned".to_string()))
}

fn lock_artifact_service<'a>(
    state: &'a AppState,
) -> AppResult<std::sync::MutexGuard<'a, crate::services::rpa_artifact_service::RpaArtifactService>> {
    state
        .rpa_artifact_service
        .lock()
        .map_err(|_| AppError::Validation("rpa artifact service lock poisoned".to_string()))
}

async fn with_profile_page<F, Fut, T>(
    app: &AppHandle,
    profile_id: &str,
    callback: F,
) -> AppResult<T>
where
    F: FnOnce(chromiumoxide::Page) -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    let websocket_url = resolve_devtools_ws_url(app, profile_id)?;
    let (browser, mut handler) = Browser::connect(websocket_url.as_str())
        .await
        .map_err(|err| AppError::Validation(format!("connect browser failed: {err}")))?;
    let handler_task = tauri::async_runtime::spawn(async move {
        while let Some(_) = handler.next().await {}
    });
    let pages = browser
        .pages()
        .await
        .map_err(|err| AppError::Validation(format!("list browser pages failed: {err}")))?;
    let page = pages
        .last()
        .cloned()
        .ok_or_else(|| AppError::Validation("browser has no pages".to_string()))?;
    let result = callback(page).await;
    handler_task.abort();
    result
}

fn resolve_devtools_ws_url(app: &AppHandle, profile_id: &str) -> AppResult<String> {
    let state = app.state::<AppState>();
    let engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| AppError::Validation("engine manager lock poisoned".to_string()))?;
    let handle = engine_manager.get_runtime_handle(profile_id)?;
    let debug_port = handle
        .debug_port
        .ok_or_else(|| AppError::Validation(format!("profile has no debug port: {profile_id}")))?;
    drop(engine_manager);

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct VersionResponse {
        web_socket_debugger_url: String,
    }

    let response = reqwest::blocking::Client::new()
        .get(format!("http://127.0.0.1:{debug_port}/json/version"))
        .send()
        .map_err(|err| AppError::Validation(format!("fetch devtools version failed: {err}")))?;
    let body: VersionResponse = response
        .json()
        .map_err(|err| AppError::Validation(format!("parse devtools version failed: {err}")))?;
    Ok(body.web_socket_debugger_url)
}

fn map_cdp_error(err: impl std::fmt::Display) -> AppError {
    AppError::Validation(format!("cdp command failed: {err}"))
}
