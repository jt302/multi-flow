use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::logger::{self, BackendLogEvent};

const LOG_PANEL_LABEL: &str = "log-panel";

#[tauri::command]
pub fn read_backend_logs(limit: Option<u64>) -> Result<Vec<BackendLogEvent>, String> {
    let capped = limit.unwrap_or(400).clamp(1, 2000) as usize;
    logger::read_recent_events(capped)
}

#[tauri::command]
pub fn open_log_panel_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LOG_PANEL_LABEL) {
        let _ = window.eval("if (window.location.pathname !== '/logs') { window.location.replace('/?standalone=logs'); }");
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        LOG_PANEL_LABEL,
        WebviewUrl::App("/?standalone=logs".into()),
    )
    .title("multi-flow 日志面板")
    .inner_size(1120.0, 760.0)
    .min_inner_size(860.0, 600.0)
    .resizable(true)
    .build()
    .map_err(|err| format!("open log panel window failed: {err}"))?;

    let _ = window.set_focus();
    Ok(())
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBackendLogsRequest {
    pub lines: Vec<String>,
    pub file_name: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBackendLogsResponse {
    pub path: String,
    pub line_count: usize,
}

#[tauri::command]
pub fn export_backend_logs(
    app: AppHandle,
    payload: ExportBackendLogsRequest,
) -> Result<ExportBackendLogsResponse, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| format!("resolve app data dir failed: {err}"))?;
    let export_dir = data_dir.join("logs").join("exports");
    std::fs::create_dir_all(&export_dir)
        .map_err(|err| format!("create export directory failed: {err}"))?;

    let default_name = format!("backend-logs-{}.log", crate::models::now_ts());
    let sanitized_name = sanitize_file_name(payload.file_name.as_deref().unwrap_or(&default_name));
    let file_path = export_dir.join(sanitized_name);
    let content = if payload.lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", payload.lines.join("\n"))
    };
    std::fs::write(&file_path, content)
        .map_err(|err| format!("write export file failed: {err}"))?;

    Ok(ExportBackendLogsResponse {
        path: file_path.to_string_lossy().to_string(),
        line_count: payload.lines.len(),
    })
}

fn sanitize_file_name(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return format!("backend-logs-{}.log", crate::models::now_ts());
    }
    let mut result = String::with_capacity(trimmed.len().min(120));
    for ch in trimmed.chars() {
        let valid = ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_');
        result.push(if valid { ch } else { '_' });
        if result.len() >= 120 {
            break;
        }
    }
    if result.is_empty() {
        format!("backend-logs-{}.log", crate::models::now_ts())
    } else if result.ends_with(".log") {
        result
    } else {
        format!("{result}.log")
    }
}
