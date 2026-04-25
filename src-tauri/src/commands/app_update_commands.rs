use serde::Serialize;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use crate::state::AppState;

const APP_UPDATE_PROGRESS_EVENT: &str = "app_update://progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub version: String,
    pub current_version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProgressEvent {
    pub phase: String,
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<Option<AppUpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|err| format!("create updater failed: {err}"))?
        .check()
        .await
        .map_err(|err| format!("check update failed: {err}"))?;

    Ok(update.map(AppUpdateInfo::from))
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<(), String> {
    ensure_can_install_update(&app)?;
    emit_update_progress(&app, "checking", 0, None);

    let update = app
        .updater()
        .map_err(|err| format!("create updater failed: {err}"))?
        .check()
        .await
        .map_err(|err| format!("check update failed: {err}"))?
        .ok_or_else(|| "当前已是最新版本".to_string())?;

    let downloaded = Arc::new(AtomicU64::new(0));
    let progress_app = app.clone();
    let finish_app = app.clone();
    let progress_downloaded = downloaded.clone();
    let finish_downloaded = downloaded.clone();
    update
        .download_and_install(
            move |chunk_length, content_length| {
                let downloaded = progress_downloaded
                    .fetch_add(chunk_length as u64, Ordering::Relaxed)
                    .saturating_add(chunk_length as u64);
                emit_update_progress(&progress_app, "download", downloaded, content_length);
            },
            move || {
                emit_update_progress(
                    &finish_app,
                    "downloaded",
                    finish_downloaded.load(Ordering::Relaxed),
                    None,
                );
            },
        )
        .await
        .map_err(|err| format!("install update failed: {err}"))?;

    emit_update_progress(&app, "installed", downloaded.load(Ordering::Relaxed), None);
    app.restart();
}

fn ensure_can_install_update(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let running_profiles = state.lock_engine_manager().active_session_count();
    let running_runs = state
        .cancel_tokens
        .lock()
        .map_err(|_| "automation run lock poisoned".to_string())?
        .len();

    running_update_blocker_message(running_profiles, running_runs).map_or(Ok(()), Err)
}

fn running_update_blocker_message(running_profiles: usize, running_runs: usize) -> Option<String> {
    if running_profiles == 0 && running_runs == 0 {
        return None;
    }
    Some(format!(
        "请先停止所有运行中的环境和自动化任务后再安装更新（运行环境：{running_profiles}，自动化任务：{running_runs}）"
    ))
}

fn emit_update_progress(app: &AppHandle, phase: &str, downloaded: u64, total: Option<u64>) {
    let _ = app.emit(
        APP_UPDATE_PROGRESS_EVENT,
        AppUpdateProgressEvent {
            phase: phase.to_string(),
            downloaded,
            total,
        },
    );
}

impl From<tauri_plugin_updater::Update> for AppUpdateInfo {
    fn from(value: tauri_plugin_updater::Update) -> Self {
        Self {
            version: value.version,
            current_version: value.current_version,
            date: value.date.map(|date| date.to_string()),
            body: value.body,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{running_update_blocker_message, AppUpdateProgressEvent};

    #[test]
    fn update_install_allowed_when_runtime_is_idle() {
        assert!(running_update_blocker_message(0, 0).is_none());
    }

    #[test]
    fn update_install_blocked_when_profiles_or_runs_are_active() {
        let message = running_update_blocker_message(2, 1).expect("blocked");
        assert!(message.contains("运行环境：2"));
        assert!(message.contains("自动化任务：1"));
    }

    #[test]
    fn update_progress_payload_keeps_expected_wire_shape() {
        let payload = AppUpdateProgressEvent {
            phase: "download".to_string(),
            downloaded: 12,
            total: Some(30),
        };
        let json = serde_json::to_value(payload).expect("serialize");
        assert_eq!(json["phase"], "download");
        assert_eq!(json["downloaded"], 12);
        assert_eq!(json["total"], 30);
    }
}
