use std::collections::HashSet;

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{
    ArrangeProfileWindowsRequest, BatchProfileActionItem, BatchProfileActionResponse,
    BatchSetWindowBoundsRequest, BatchWindowActionRequest, BroadcastSyncTextRequest,
    DisplayMonitorItem, EnsureSyncSidecarStartedResponse, ListSyncTargetsResponse,
    ProfileWindowState, SyncTargetItem, WindowArrangeMode, WindowBounds,
};
use crate::runtime_guard;
use crate::services::display_monitor_service;
use crate::state::AppState;

#[tauri::command]
pub fn ensure_sync_sidecar_started(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<EnsureSyncSidecarStartedResponse, String> {
    ensure_sync_sidecar_started_inner(Some(&app), &state).map_err(error_to_string)
}

fn ensure_sync_sidecar_started_inner(
    app: Option<&AppHandle>,
    state: &AppState,
) -> AppResult<EnsureSyncSidecarStartedResponse> {
    let mut service = state.lock_sync_manager_service();
    service.ensure_started(app)
}

#[tauri::command]
pub fn list_sync_targets(state: State<'_, AppState>) -> Result<ListSyncTargetsResponse, String> {
    if let Err(err) = runtime_guard::reconcile_runtime_state(&state) {
        logger::warn(
            "sync_cmd",
            format!("list_sync_targets reconcile failed: {err}"),
        );
    }
    let states = collect_window_states(&state)?;
    let profile_service = state.lock_profile_service();
    let engine_manager = state.lock_engine_manager();

    let items = states
        .into_iter()
        .map(|state_item| {
            let label = profile_service
                .get_profile(&state_item.profile_id)
                .map(|profile| profile.name)
                .unwrap_or_else(|_| state_item.profile_id.clone());
            let magic_socket_server_port = engine_manager
                .get_runtime_handle(&state_item.profile_id)
                .ok()
                .and_then(|handle| handle.magic_port);
            let adapter_port = magic_socket_server_port.and_then(|port| {
                Some(state.lock_chromium_magic_adapter_service()).and_then(|mut service| {
                    service
                        .ensure_adapter(&state_item.profile_id, "127.0.0.1", port)
                        .ok()
                })
            });
            SyncTargetItem {
                profile_id: state_item.profile_id,
                label,
                host: "127.0.0.1".to_string(),
                magic_socket_server_port: adapter_port,
                session_id: state_item.session_id,
                pid: state_item.pid,
                total_windows: state_item.total_windows,
                total_tabs: state_item.total_tabs,
                windows: state_item.windows,
            }
        })
        .collect::<Vec<_>>();

    Ok(ListSyncTargetsResponse { items })
}

#[tauri::command]
pub fn broadcast_sync_text(
    state: State<'_, AppState>,
    payload: BroadcastSyncTextRequest,
) -> Result<BatchProfileActionResponse, String> {
    let text = payload.text.trim().to_string();
    if text.is_empty() {
        return Err("请输入要同步的文本".to_string());
    }
    let profile_ids = normalize_profile_ids(payload.profile_ids);
    if profile_ids.is_empty() {
        return Err("请选择至少一个从控环境".to_string());
    }

    run_batch_engine_action(
        "broadcast_sync_text",
        state,
        profile_ids,
        |engine_manager, profile_id| engine_manager.type_string(profile_id, text.as_str()),
    )
}

#[tauri::command]
pub fn list_display_monitors(app: AppHandle) -> Result<Vec<DisplayMonitorItem>, String> {
    display_monitor_service::collect_display_monitors(&app).map_err(error_to_string)
}

#[tauri::command]
pub fn batch_restore_profile_windows(
    state: State<'_, AppState>,
    payload: BatchWindowActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_engine_action(
        "batch_restore_profile_windows",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.restore_window(profile_id, None),
    )
}

#[tauri::command]
pub fn batch_set_profile_window_bounds(
    state: State<'_, AppState>,
    payload: BatchSetWindowBoundsRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_engine_action(
        "batch_set_profile_window_bounds",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| {
            engine_manager.set_window_bounds(profile_id, payload.bounds.clone(), None)
        },
    )
}

#[tauri::command]
pub fn arrange_profile_windows(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: ArrangeProfileWindowsRequest,
) -> Result<BatchProfileActionResponse, String> {
    if payload.width <= 0 || payload.height <= 0 {
        return Err("排列窗口宽高必须为正数".to_string());
    }
    if payload.gap < 0 {
        return Err("窗口间距不能小于 0".to_string());
    }
    let monitors = display_monitor_service::collect_display_monitors(&app).map_err(error_to_string)?;
    let monitor = monitors
        .into_iter()
        .find(|item| item.id == payload.monitor_id)
        .ok_or_else(|| "目标显示器不存在".to_string())?;
    let profile_ids = normalize_profile_ids(payload.profile_ids);
    let arranged_bounds = build_arranged_bounds(
        &monitor.work_area,
        payload.mode,
        profile_ids.len(),
        payload.width,
        payload.height,
        payload.gap,
    );

    logger::info(
        "sync_cmd",
        format!(
            "arrange_profile_windows request profile_count={} monitor_id={} mode={:?}",
            profile_ids.len(),
            monitor.id,
            payload.mode
        ),
    );
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let mut items = Vec::with_capacity(profile_ids.len());
    let mut success_count = 0usize;

    for (index, profile_id) in profile_ids.into_iter().enumerate() {
        let result = (|| -> Result<(), AppError> {
            let bounds = arranged_bounds
                .get(index)
                .cloned()
                .ok_or_else(|| AppError::Validation("missing arranged bounds".to_string()))?;
            let _ = engine_manager.restore_window(&profile_id, None)?;
            let _ = engine_manager.set_window_bounds(&profile_id, bounds, None)?;
            Ok(())
        })();
        match result {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

fn collect_window_states(state: &AppState) -> Result<Vec<ProfileWindowState>, String> {
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let mut states = engine_manager.list_window_states();
    drop(engine_manager);

    let existing_ids = states
        .iter()
        .map(|item| item.profile_id.clone())
        .collect::<HashSet<_>>();

    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| "engine session service lock poisoned".to_string())?;
    let running_profile_ids = profile_service
        .list_running_profile_ids()
        .map_err(error_to_string)?;
    for profile_id in running_profile_ids {
        if existing_ids.contains(&profile_id) {
            continue;
        }
        let session = engine_session_service
            .get_session(&profile_id)
            .map_err(error_to_string)?;
        states.push(ProfileWindowState {
            profile_id,
            session_id: session.as_ref().map(|item| item.session_id).unwrap_or(0),
            pid: session.and_then(|item| item.pid),
            total_windows: 0,
            total_tabs: 0,
            windows: Vec::new(),
        });
    }
    states.sort_by(|a, b| a.profile_id.cmp(&b.profile_id));
    Ok(states)
}

fn build_arranged_bounds(
    area: &WindowBounds,
    mode: WindowArrangeMode,
    count: usize,
    width: i32,
    height: i32,
    gap: i32,
) -> Vec<WindowBounds> {
    if count == 0 {
        return Vec::new();
    }

    match mode {
        WindowArrangeMode::Grid => {
            let columns = (count as f64).sqrt().ceil() as i32;
            (0..count)
                .map(|index| {
                    let column = (index as i32) % columns;
                    let row = (index as i32) / columns;
                    WindowBounds {
                        x: area.x + column * (width + gap),
                        y: area.y + row * (height + gap),
                        width,
                        height,
                    }
                })
                .collect()
        }
        WindowArrangeMode::Cascade => (0..count)
            .map(|index| {
                let offset = index as i32 * gap;
                WindowBounds {
                    x: area.x + offset,
                    y: area.y + offset,
                    width,
                    height,
                }
            })
            .collect(),
    }
}

fn normalize_profile_ids(profile_ids: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for profile_id in profile_ids {
        if seen.insert(profile_id.clone()) {
            unique.push(profile_id);
        }
    }
    unique
}

fn run_batch_engine_action<F>(
    action_name: &str,
    state: State<'_, AppState>,
    profile_ids: Vec<String>,
    mut action: F,
) -> Result<BatchProfileActionResponse, String>
where
    F: FnMut(
        &mut crate::engine_manager::EngineManager,
        &str,
    ) -> Result<ProfileWindowState, AppError>,
{
    logger::info(
        "sync_cmd",
        format!("{action_name} request profile_count={}", profile_ids.len()),
    );
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let mut items = Vec::with_capacity(profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in normalize_profile_ids(profile_ids) {
        match action(&mut engine_manager, &profile_id) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::db;
    use crate::engine_manager::EngineManager;
    use crate::local_api_server::LocalApiServer;
    use crate::services::app_preference_service::AppPreferenceService;
    use crate::services::automation_service::AutomationService;
    use crate::services::chromium_magic_adapter_service::ChromiumMagicAdapterService;
    use crate::services::device_preset_service::DevicePresetService;
    use crate::services::engine_session_service::EngineSessionService;
    use crate::services::plugin_package_service::PluginPackageService;
    use crate::services::profile_group_service::ProfileGroupService;
    use crate::services::profile_service::ProfileService;
    use crate::services::proxy_service::ProxyService;
    use crate::services::resource_service::ResourceService;
    use crate::services::sync_manager_service::SyncManagerService;
    use crate::state::AppState;

    #[test]
    fn build_arranged_bounds_grid_tiles_in_rows() {
        let area = WindowBounds {
            x: 10,
            y: 20,
            width: 1920,
            height: 1080,
        };

        let bounds = build_arranged_bounds(&area, WindowArrangeMode::Grid, 3, 400, 300, 16);

        assert_eq!(bounds.len(), 3);
        assert_eq!(bounds[0].x, 10);
        assert_eq!(bounds[0].y, 20);
        assert_eq!(bounds[1].x, 426);
        assert_eq!(bounds[1].y, 20);
        assert_eq!(bounds[2].x, 10);
        assert_eq!(bounds[2].y, 336);
    }

    #[test]
    fn build_arranged_bounds_cascade_offsets_each_window() {
        let area = WindowBounds {
            x: 100,
            y: 120,
            width: 1920,
            height: 1080,
        };

        let bounds = build_arranged_bounds(&area, WindowArrangeMode::Cascade, 3, 500, 400, 24);

        assert_eq!(bounds[0].x, 100);
        assert_eq!(bounds[0].y, 120);
        assert_eq!(bounds[1].x, 124);
        assert_eq!(bounds[1].y, 144);
        assert_eq!(bounds[2].x, 148);
        assert_eq!(bounds[2].y, 168);
    }

    #[test]
    fn ensure_sync_sidecar_started_is_idempotent_in_mock_mode() {
        let state = new_test_state();

        let first = ensure_sync_sidecar_started_inner(None, &state).expect("first ensure");
        let second = ensure_sync_sidecar_started_inner(None, &state).expect("second ensure");

        assert_eq!(first.port, second.port);
        assert_eq!(first.already_running, false);
        assert_eq!(second.already_running, true);
    }

    fn new_test_state() -> AppState {
        let db = db::init_test_database().expect("init test db");
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let profile_service = ProfileService::from_db(db.clone());
        let device_preset_service = DevicePresetService::from_db(db.clone());
        let plugin_package_service = PluginPackageService::from_db(db.clone());
        let engine_session_service = EngineSessionService::from_db(db.clone());
        let proxy_service = ProxyService::from_db(db.clone());
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let resource_dir = std::env::temp_dir().join(format!("multi-flow-sync-cmd-test-{unique}"));
        let resource_service =
            ResourceService::from_data_dir(&resource_dir).expect("resource service");
        let app_preference_service = AppPreferenceService::from_data_dir(resource_dir.clone());
        let mut local_api_server = LocalApiServer::new("127.0.0.1:18180");
        local_api_server.mark_started();

        AppState {
            active_run_channels: Mutex::new(std::collections::HashMap::new()),
            cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            ai_dialog_channels: Mutex::new(std::collections::HashMap::new()),
            automation_service: Mutex::new(AutomationService::from_db(db.clone())),
            profile_group_service: Mutex::new(profile_group_service),
            profile_service: Mutex::new(profile_service),
            device_preset_service: Mutex::new(device_preset_service),
            app_preference_service: Mutex::new(app_preference_service),
            plugin_package_service: Mutex::new(plugin_package_service),
            engine_session_service: Mutex::new(engine_session_service),
            proxy_service: Mutex::new(proxy_service),
            resource_service: Mutex::new(resource_service),
            engine_manager: Mutex::new(EngineManager::new()),
            local_api_server: Mutex::new(local_api_server),
            chromium_magic_adapter_service: Mutex::new(ChromiumMagicAdapterService::new()),
            sync_manager_service: Mutex::new(SyncManagerService::new_mock(None, None)),
            require_real_engine: false,
        }
    }
}
