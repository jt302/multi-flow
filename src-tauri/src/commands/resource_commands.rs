use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::AppError;
use crate::models::{
    ResourceActivateResponse, ResourceCatalogResponse, ResourceDownloadResponse,
    ResourceInstallResponse, ResourceProgressSnapshot,
};
use crate::state::AppState;

const RESOURCE_PROGRESS_EVENT: &str = "resource_download_progress";

#[tauri::command]
pub async fn list_resources(app: AppHandle) -> Result<ResourceCatalogResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let resource_service = state.lock_resource_service();
        resource_service.list_resources().map_err(error_to_string)
    })
    .await
    .map_err(|err| format!("list resources task join failed: {err}"))?
}

#[tauri::command]
pub fn get_active_resource_downloads(
    state: State<'_, AppState>,
) -> Result<Vec<ResourceProgressSnapshot>, String> {
    let guard = state
        .active_resource_downloads
        .lock()
        .map_err(|_| "active resource downloads lock poisoned".to_string())?;
    Ok(guard.values().cloned().collect())
}

#[tauri::command]
pub async fn download_resource(
    app: AppHandle,
    state: State<'_, AppState>,
    resource_id: String,
    force: Option<bool>,
    task_id: Option<String>,
) -> Result<ResourceDownloadResponse, String> {
    let task_id = task_id.unwrap_or_else(|| format!("download-{}", crate::models::now_ts()));
    let service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?
        .clone();
    emit_progress(
        &app,
        &task_id,
        &resource_id,
        "start",
        0,
        None,
        "Starting download",
    );
    let app_c = app.clone();
    let task_id_c = task_id.clone();
    let resource_id_c = resource_id.clone();
    let force = force.unwrap_or(false);
    let result = tauri::async_runtime::spawn_blocking(move || {
        service.download_resource_with_progress(&resource_id_c, force, |downloaded, total| {
            emit_progress(
                &app_c,
                &task_id_c,
                &resource_id_c,
                "download",
                downloaded,
                total,
                "Downloading",
            );
        })
    })
    .await
    .map_err(|e| format!("task join error: {e}"))?;
    match result {
        Ok(response) => {
            emit_progress(
                &app,
                &task_id,
                &resource_id,
                "done",
                response.bytes,
                Some(response.bytes),
                "Done",
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
                &err.to_string(),
            );
            Err(error_to_string(err))
        }
    }
}

#[tauri::command]
pub async fn install_chromium_resource(
    app: AppHandle,
    state: State<'_, AppState>,
    resource_id: String,
    force_download: Option<bool>,
    force_install: Option<bool>,
    activate: Option<bool>,
    task_id: Option<String>,
) -> Result<ResourceInstallResponse, String> {
    let task_id = task_id.unwrap_or_else(|| format!("install-{}", crate::models::now_ts()));
    let service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?
        .clone();
    emit_progress(
        &app,
        &task_id,
        &resource_id,
        "start",
        0,
        None,
        "Starting download",
    );
    let app_c = app.clone();
    let task_id_c = task_id.clone();
    let resource_id_c = resource_id.clone();
    let force_download = force_download.unwrap_or(false);
    let force_install = force_install.unwrap_or(false);
    let activate = activate.unwrap_or(true);
    let result = tauri::async_runtime::spawn_blocking(move || {
        service.install_chromium_resource_with_progress(
            &resource_id_c,
            force_download,
            force_install,
            activate,
            |stage, downloaded, total| {
                emit_progress(
                    &app_c,
                    &task_id_c,
                    &resource_id_c,
                    stage,
                    downloaded,
                    total,
                    match stage {
                        "download" => "Downloading",
                        "install" => "Installing",
                        "done" => "Done",
                        _ => "Processing",
                    },
                );
            },
        )
    })
    .await
    .map_err(|e| format!("task join error: {e}"))?;
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
                &err.to_string(),
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
    let snapshot = ResourceProgressSnapshot {
        task_id: task_id.to_string(),
        resource_id: resource_id.to_string(),
        stage: stage.to_string(),
        downloaded_bytes,
        total_bytes,
        percent,
        message: message.to_string(),
        updated_at: crate::models::now_ts(),
    };

    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.active_resource_downloads.lock() {
        match stage {
            "done" | "error" => {
                guard.remove(task_id);
            }
            _ => {
                guard.insert(task_id.to_string(), snapshot.clone());
            }
        }
    }

    let _ = app.emit(RESOURCE_PROGRESS_EVENT, snapshot);
}
