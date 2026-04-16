use std::collections::HashSet;

use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::logger;
use crate::models::{
    BatchProfileActionItem, BatchProfileActionResponse, BatchWindowActionRequest,
    BatchWindowOpenRequest, ProfileWindowState, WindowBounds,
};
use crate::state::AppState;

#[tauri::command]
pub async fn list_open_profile_windows(app: AppHandle) -> Result<Vec<ProfileWindowState>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        list_open_profile_windows_inner(&state)
    })
    .await
    .map_err(|err| format!("list open profile windows task join failed: {err}"))?
}

fn list_open_profile_windows_inner(state: &AppState) -> Result<Vec<ProfileWindowState>, String> {
    let mut engine_manager = state.lock_engine_manager();
    let mut states = engine_manager.list_window_states();
    drop(engine_manager);

    let existing_ids = states
        .iter()
        .map(|item| item.profile_id.clone())
        .collect::<HashSet<_>>();

    let profile_service = state.lock_profile_service();
    let engine_session_service = state.lock_engine_session_service();
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

#[tauri::command]
pub fn open_profile_tab(
    state: State<'_, AppState>,
    profile_id: String,
    url: Option<String>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("open_profile_tab request profile_id={profile_id} url={url:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .open_tab(&profile_id, url)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("open_profile_tab success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("open_profile_tab failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn close_profile_tab(
    state: State<'_, AppState>,
    profile_id: String,
    tab_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("close_profile_tab request profile_id={profile_id} tab_id={tab_id:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .close_tab(&profile_id, tab_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("close_profile_tab success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("close_profile_tab failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn close_inactive_tabs(
    state: State<'_, AppState>,
    profile_id: String,
    window_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("close_inactive_tabs request profile_id={profile_id} window_id={window_id:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .close_inactive_tabs(&profile_id, window_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("close_inactive_tabs success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("close_inactive_tabs failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn open_profile_window(
    state: State<'_, AppState>,
    profile_id: String,
    url: Option<String>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("open_profile_window request profile_id={profile_id} url={url:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .open_window(&profile_id, url)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("open_profile_window success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("open_profile_window failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn close_profile_window(
    state: State<'_, AppState>,
    profile_id: String,
    window_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("close_profile_window request profile_id={profile_id} window_id={window_id:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .close_window(&profile_id, window_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("close_profile_window success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("close_profile_window failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn focus_profile_window(
    state: State<'_, AppState>,
    profile_id: String,
    window_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("focus_profile_window request profile_id={profile_id} window_id={window_id:?}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .focus_window(&profile_id, window_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("focus_profile_window success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("focus_profile_window failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn set_profile_window_bounds(
    state: State<'_, AppState>,
    profile_id: String,
    bounds: WindowBounds,
    window_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!(
            "set_profile_window_bounds request profile_id={profile_id} window_id={window_id:?} bounds={bounds:?}"
        ),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .set_window_bounds(&profile_id, bounds, window_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state(
                "set_profile_window_bounds success",
                &profile_id,
                window_state,
            ),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("set_profile_window_bounds failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn activate_tab(
    state: State<'_, AppState>,
    profile_id: String,
    tab_id: u64,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!("activate_tab request profile_id={profile_id} tab_id={tab_id}"),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .activate_tab(&profile_id, tab_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("activate_tab success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("activate_tab failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn activate_tab_by_index(
    state: State<'_, AppState>,
    profile_id: String,
    index: u64,
    window_id: Option<u64>,
) -> Result<ProfileWindowState, String> {
    logger::info(
        "window_cmd",
        format!(
            "activate_tab_by_index request profile_id={profile_id} index={index} window_id={window_id:?}"
        ),
    );
    let mut engine_manager = state.lock_engine_manager();
    let result = engine_manager
        .activate_tab_by_index(&profile_id, index as usize, window_id)
        .map_err(error_to_string);
    match &result {
        Ok(window_state) => logger::info(
            "window_cmd",
            format_window_state("activate_tab_by_index success", &profile_id, window_state),
        ),
        Err(err) => logger::warn(
            "window_cmd",
            format!("activate_tab_by_index failed profile_id={profile_id}: {err}"),
        ),
    }
    result
}

#[tauri::command]
pub fn batch_open_profile_tabs(
    state: State<'_, AppState>,
    payload: BatchWindowOpenRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_action(
        "batch_open_profile_tabs",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.open_tab(profile_id, payload.url.clone()),
    )
}

#[tauri::command]
pub fn batch_close_profile_tabs(
    state: State<'_, AppState>,
    payload: BatchWindowActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_action(
        "batch_close_profile_tabs",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.close_tab(profile_id, None),
    )
}

#[tauri::command]
pub fn batch_open_profile_windows(
    state: State<'_, AppState>,
    payload: BatchWindowOpenRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_action(
        "batch_open_profile_windows",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.open_window(profile_id, payload.url.clone()),
    )
}

#[tauri::command]
pub fn batch_focus_profile_windows(
    state: State<'_, AppState>,
    payload: BatchWindowActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_action(
        "batch_focus_profile_windows",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.focus_window(profile_id, None),
    )
}

#[tauri::command]
pub fn batch_close_inactive_tabs(
    state: State<'_, AppState>,
    payload: BatchWindowActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_action(
        "batch_close_inactive_tabs",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.close_inactive_tabs(profile_id, None),
    )
}

fn run_batch_action<F>(
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
        "window_cmd",
        format!("{action_name} request profile_count={}", profile_ids.len()),
    );
    let mut engine_manager = state.lock_engine_manager();
    let mut items = Vec::with_capacity(profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in profile_ids {
        match action(&mut engine_manager, &profile_id) {
            Ok(_) => {
                success_count += 1;
                logger::info(
                    "window_cmd",
                    format!("{action_name} item success profile_id={profile_id}"),
                );
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                logger::warn(
                    "window_cmd",
                    format!("{action_name} item failed profile_id={profile_id}: {err}"),
                );
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    let response = BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    };
    logger::info(
        "window_cmd",
        format!(
            "{action_name} finished total={} success={} failed={}",
            response.total, response.success_count, response.failed_count
        ),
    );
    Ok(response)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}

fn format_window_state(
    prefix: &str,
    profile_id: &str,
    window_state: &ProfileWindowState,
) -> String {
    format!(
        "{prefix} profile_id={profile_id} session_id={} pid={:?} total_windows={} total_tabs={}",
        window_state.session_id,
        window_state.pid,
        window_state.total_windows,
        window_state.total_tabs
    )
}

/// 闪屏 JS listener 注册完毕后调用，通知 Rust 可以开始 emit 进度事件
#[tauri::command]
pub fn splashscreen_ready() {
    crate::SPLASH_READY.store(true, std::sync::atomic::Ordering::Release);
}

/// React 就绪且 init 完成后调用：关闭 splash，显示主窗口
/// 两步原子完成，消除 splash 关闭到主窗口出现之间的空档
#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    crate::show_main_window_if_needed(&app, "frontend-ready");
}

/// React 挂载时查询 init 是否已完成（处理 React 比 init 慢的竞态情况）
#[tauri::command]
pub fn is_init_complete() -> bool {
    crate::INIT_COMPLETE.load(std::sync::atomic::Ordering::Acquire)
}
