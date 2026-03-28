use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 每个脚本的画布窗口 label 前缀（取 script_id 前 8 位保证唯一性）
fn canvas_window_label(script_id: &str) -> String {
    format!("automation-canvas-{}", &script_id[..script_id.len().min(8)])
}

#[tauri::command]
pub fn open_automation_canvas_window(
    app: AppHandle,
    script_id: String,
    script_name: String,
) -> Result<(), String> {
    let label = canvas_window_label(&script_id);
    // 已存在则聚焦复用
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }
    let url = format!("/automation/{}/canvas", script_id);
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(format!("画布 — {}", script_name))
        .inner_size(1440.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("open canvas window failed: {e}"))?;
    Ok(())
}
