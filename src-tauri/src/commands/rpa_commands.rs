use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::logger;
use crate::models::{
    CancelRpaRunRequest, CreateRpaFlowRequest, ResumeRpaInstanceRequest, RpaFlow, RpaRun,
    RpaRunDetails, RpaRunStep, RunRpaFlowRequest, UpdateRpaFlowRequest,
};
use crate::services::rpa_runtime_service::RpaRuntimeService;
use crate::state::AppState;

const RPA_EDITOR_LABEL: &str = "rpa-flow-editor";
const RPA_FLOWS_UPDATED_EVENT: &str = "rpa:flows-updated";

#[tauri::command]
pub fn create_rpa_flow(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: CreateRpaFlowRequest,
) -> Result<RpaFlow, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    let flow = service.create_flow(payload).map_err(error_to_string)?;
    let _ = app.emit(RPA_FLOWS_UPDATED_EVENT, &flow);
    Ok(flow)
}

#[tauri::command]
pub fn update_rpa_flow(
    app: AppHandle,
    state: State<'_, AppState>,
    flow_id: String,
    payload: UpdateRpaFlowRequest,
) -> Result<RpaFlow, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    let flow = service.update_flow(&flow_id, payload).map_err(error_to_string)?;
    let _ = app.emit(RPA_FLOWS_UPDATED_EVENT, &flow);
    Ok(flow)
}

#[tauri::command]
pub fn list_rpa_flows(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<Vec<RpaFlow>, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    service
        .list_flows(include_deleted.unwrap_or(false))
        .map_err(error_to_string)
}

#[tauri::command]
pub fn get_rpa_flow(state: State<'_, AppState>, flow_id: String) -> Result<Option<RpaFlow>, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    service.get_flow(&flow_id).map_err(error_to_string)
}

#[tauri::command]
pub fn delete_rpa_flow(app: AppHandle, state: State<'_, AppState>, flow_id: String) -> Result<RpaFlow, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    let flow = service.delete_flow(&flow_id).map_err(error_to_string)?;
    let _ = app.emit(RPA_FLOWS_UPDATED_EVENT, &flow);
    Ok(flow)
}

#[tauri::command]
pub fn restore_rpa_flow(app: AppHandle, state: State<'_, AppState>, flow_id: String) -> Result<RpaFlow, String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    let flow = service.restore_flow(&flow_id).map_err(error_to_string)?;
    let _ = app.emit(RPA_FLOWS_UPDATED_EVENT, &flow);
    Ok(flow)
}

#[tauri::command]
pub fn purge_rpa_flow(app: AppHandle, state: State<'_, AppState>, flow_id: String) -> Result<(), String> {
    let service = state
        .rpa_flow_service
        .lock()
        .map_err(|_| "rpa flow service lock poisoned".to_string())?;
    service.purge_flow(&flow_id).map_err(error_to_string)?;
    let _ = app.emit(RPA_FLOWS_UPDATED_EVENT, serde_json::json!({ "flowId": flow_id, "kind": "purged" }));
    Ok(())
}

#[tauri::command]
pub fn run_rpa_flow(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: RunRpaFlowRequest,
) -> Result<RpaRun, String> {
    logger::info(
        "rpa_cmd",
        format!(
            "run_rpa_flow request flow_id={} targets={}",
            payload.flow_id,
            payload.target_profile_ids.len()
        ),
    );
    let flow = {
        let flow_service = state
            .rpa_flow_service
            .lock()
            .map_err(|_| "rpa flow service lock poisoned".to_string())?;
        flow_service
            .get_flow(&payload.flow_id)
            .map_err(error_to_string)?
            .ok_or_else(|| format!("not found: rpa flow not found: {}", payload.flow_id))?
    };
    let run = {
        let run_service = state
            .rpa_run_service
            .lock()
            .map_err(|_| "rpa run service lock poisoned".to_string())?;
        run_service
            .create_run(&flow, payload.clone())
            .map_err(error_to_string)?
    };
    {
        let flow_service = state
            .rpa_flow_service
            .lock()
            .map_err(|_| "rpa flow service lock poisoned".to_string())?;
        flow_service
            .touch_last_run(&flow.id, crate::models::now_ts())
            .map_err(error_to_string)?;
    }
    RpaRuntimeService::spawn_run(app, run.id.clone());
    Ok(run)
}

#[tauri::command]
pub fn list_rpa_runs(
    state: State<'_, AppState>,
    limit: Option<u64>,
) -> Result<Vec<RpaRun>, String> {
    let service = state
        .rpa_run_service
        .lock()
        .map_err(|_| "rpa run service lock poisoned".to_string())?;
    service.list_runs(limit).map_err(error_to_string)
}

#[tauri::command]
pub fn get_rpa_run_details(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<Option<RpaRunDetails>, String> {
    let service = state
        .rpa_run_service
        .lock()
        .map_err(|_| "rpa run service lock poisoned".to_string())?;
    service.get_run_details(&run_id).map_err(error_to_string)
}

#[tauri::command]
pub fn list_rpa_run_steps(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<RpaRunStep>, String> {
    let service = state
        .rpa_run_service
        .lock()
        .map_err(|_| "rpa run service lock poisoned".to_string())?;
    service.list_run_steps(&instance_id).map_err(error_to_string)
}

#[tauri::command]
pub fn cancel_rpa_run(
    state: State<'_, AppState>,
    payload: CancelRpaRunRequest,
) -> Result<RpaRun, String> {
    let service = state
        .rpa_run_service
        .lock()
        .map_err(|_| "rpa run service lock poisoned".to_string())?;
    service.cancel_run(&payload.run_id).map_err(error_to_string)
}

#[tauri::command]
pub fn cancel_rpa_run_instance(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<(), String> {
    let service = state
        .rpa_run_service
        .lock()
        .map_err(|_| "rpa run service lock poisoned".to_string())?;
    service.cancel_instance(&instance_id).map_err(error_to_string)?;
    Ok(())
}

#[tauri::command]
pub fn resume_rpa_instance(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: ResumeRpaInstanceRequest,
) -> Result<(), String> {
    {
        let service = state
            .rpa_run_service
            .lock()
            .map_err(|_| "rpa run service lock poisoned".to_string())?;
        let instance = service
            .get_instance(&payload.instance_id)
            .map_err(error_to_string)?;
        if !matches!(
            instance.status,
            crate::models::RpaRunInstanceStatus::NeedsManual
        ) {
            return Err("conflict: instance is not waiting for manual continue".to_string());
        }
    }
    RpaRuntimeService::spawn_resume_instance(app, payload.instance_id);
    Ok(())
}

#[tauri::command]
pub fn open_rpa_flow_editor_window(app: AppHandle, flow_id: Option<String>) -> Result<(), String> {
    let target_path = build_rpa_editor_window_path(flow_id.as_deref());
    if let Some(window) = app.get_webview_window(RPA_EDITOR_LABEL) {
        let target_json =
            serde_json::to_string(&target_path).map_err(|err| format!("serialize target failed: {err}"))?;
        let script = format!(
            "if (window.location.pathname + window.location.search !== {target}) {{ window.location.replace({target}); }}",
            target = target_json
        );
        let _ = window.eval(&script);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        RPA_EDITOR_LABEL,
        WebviewUrl::App(target_path.into()),
    )
    .title("multi-flow RPA 编辑器")
    .inner_size(1480.0, 920.0)
    .min_inner_size(1180.0, 760.0)
    .resizable(true)
    .build()
    .map_err(|err| format!("open rpa flow editor window failed: {err}"))?;

    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub fn close_rpa_flow_editor_window(app: AppHandle) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
    }
    if let Some(editor_window) = app.get_webview_window(RPA_EDITOR_LABEL) {
        editor_window
            .destroy()
            .map_err(|err| format!("destroy rpa flow editor window failed: {err}"))?;
    }
    Ok(())
}

fn error_to_string(err: crate::error::AppError) -> String {
    err.to_string()
}

fn build_rpa_editor_window_path(flow_id: Option<&str>) -> String {
    let flow_id = flow_id.map(str::trim).filter(|value| !value.is_empty());
    match flow_id {
        Some(flow_id) => format!("/?standalone=rpa-editor&flowId={flow_id}"),
        None => "/?standalone=rpa-editor&mode=create".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::build_rpa_editor_window_path;
    use super::RPA_EDITOR_LABEL;

    #[test]
    fn build_rpa_editor_window_path_defaults_to_create_mode() {
        assert_eq!(
            build_rpa_editor_window_path(None),
            "/?standalone=rpa-editor&mode=create"
        );
    }

    #[test]
    fn build_rpa_editor_window_path_uses_flow_id_when_present() {
        assert_eq!(
            build_rpa_editor_window_path(Some("flow_123")),
            "/?standalone=rpa-editor&flowId=flow_123"
        );
    }

    #[test]
    fn rpa_editor_label_is_stable() {
        assert_eq!(RPA_EDITOR_LABEL, "rpa-flow-editor");
    }
}
