use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::models::{
    ResourceActivateResponse, ResourceCatalogResponse, ResourceDownloadResponse,
    ResourceInstallResponse,
};
use crate::state::AppState;

const RESOURCE_PROGRESS_EVENT: &str = "resource_download_progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResourceDownloadProgressEvent {
    task_id: String,
    resource_id: String,
    stage: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<f64>,
    message: String,
}

#[tauri::command]
pub fn list_resources(state: State<'_, AppState>) -> Result<ResourceCatalogResponse, String> {
    let resource_service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?;
    resource_service.list_resources().map_err(error_to_string)
}

#[tauri::command]
pub fn download_resource(
    app: AppHandle,
    state: State<'_, AppState>,
    resource_id: String,
    force: Option<bool>,
    task_id: Option<String>,
) -> Result<ResourceDownloadResponse, String> {
    let task_id = task_id.unwrap_or_else(|| format!("download-{}", crate::models::now_ts()));
    let resource_service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?;
    emit_progress(
        &app,
        &task_id,
        &resource_id,
        "start",
        0,
        None,
        "开始下载资源",
    );
    let result = resource_service.download_resource_with_progress(
        &resource_id,
        force.unwrap_or(false),
        |downloaded, total| {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                "download",
                downloaded,
                total,
                "下载中",
            );
        },
    );
    match result {
        Ok(response) => {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                "done",
                response.bytes,
                Some(response.bytes),
                "已完成",
            );
            Ok(response)
        }
        Err(err) => {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                "error",
                0,
                None,
                &format!("失败: {}", err),
            );
            Err(error_to_string(err))
        }
    }
}

#[tauri::command]
pub fn install_chromium_resource(
    app: AppHandle,
    state: State<'_, AppState>,
    resource_id: String,
    force_download: Option<bool>,
    force_install: Option<bool>,
    activate: Option<bool>,
    task_id: Option<String>,
) -> Result<ResourceInstallResponse, String> {
    let task_id = task_id.unwrap_or_else(|| format!("install-{}", crate::models::now_ts()));
    let resource_service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?;

    emit_progress(
        &app,
        &task_id,
        &resource_id,
        "start",
        0,
        None,
        "开始下载资源",
    );

    let result = resource_service.install_chromium_resource_with_progress(
        &resource_id,
        force_download.unwrap_or(false),
        force_install.unwrap_or(false),
        activate.unwrap_or(true),
        |stage, downloaded, total| {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                stage,
                downloaded,
                total,
                match stage {
                    "download" => "下载中",
                    "install" => "安装并激活中",
                    "done" => "已完成",
                    _ => "处理中",
                },
            );
        },
    );

    match result {
        Ok(response) => Ok(response),
        Err(err) => {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                "error",
                0,
                None,
                &format!("失败: {}", err),
            );
            Err(error_to_string(err))
        }
    }
}

#[tauri::command]
pub fn activate_chromium_version(
    state: State<'_, AppState>,
    version: String,
) -> Result<ResourceActivateResponse, String> {
    let resource_service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?;
    resource_service
        .activate_chromium_version(&version)
        .map_err(error_to_string)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}

fn emit_progress(
    app: &AppHandle,
    task_id: &str,
    resource_id: &str,
    stage: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    message: &str,
) {
    let percent = total_bytes.and_then(|total| {
        if total == 0 {
            None
        } else {
            Some(((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0))
        }
    });
    let payload = ResourceDownloadProgressEvent {
        task_id: task_id.to_string(),
        resource_id: resource_id.to_string(),
        stage: stage.to_string(),
        downloaded_bytes,
        total_bytes,
        percent,
        message: message.to_string(),
    };
    let _ = app.emit(RESOURCE_PROGRESS_EVENT, payload);
}
