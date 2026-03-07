use tauri::State;

use crate::error::AppError;
use crate::models::{
    BatchProfileActionItem, BatchProfileActionRequest, BatchProfileActionResponse,
    CreateProfileRequest, ListProfilesResponse, LocalApiServerStatus, OpenProfileResponse, Profile,
};
use crate::state::AppState;

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    payload: CreateProfileRequest,
) -> Result<Profile, String> {
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_service
        .create_profile(payload)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn list_profiles(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<ListProfilesResponse, String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    Ok(profile_service.list_profiles(include_deleted.unwrap_or(false)))
}

#[tauri::command]
pub fn open_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<OpenProfileResponse, String> {
    do_open_profile(&state, &profile_id)
}

#[tauri::command]
pub fn close_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    do_close_profile(&state, &profile_id)
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    if engine_manager.is_running(&profile_id) {
        let _ = engine_manager.close_profile(&profile_id);
    }

    profile_service
        .soft_delete_profile(&profile_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn restore_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_service
        .restore_profile(&profile_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn batch_open_profiles(
    state: State<'_, AppState>,
    payload: BatchProfileActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    let mut items = Vec::with_capacity(payload.profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in payload.profile_ids {
        match do_open_profile(&state, &profile_id) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "opened".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err,
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

#[tauri::command]
pub fn batch_close_profiles(
    state: State<'_, AppState>,
    payload: BatchProfileActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    let mut items = Vec::with_capacity(payload.profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in payload.profile_ids {
        match do_close_profile(&state, &profile_id) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "closed".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err,
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

#[tauri::command]
pub fn get_local_api_server_status(
    state: State<'_, AppState>,
) -> Result<LocalApiServerStatus, String> {
    let local_api_server = state
        .local_api_server
        .lock()
        .map_err(|_| "local api server lock poisoned".to_string())?;
    Ok(local_api_server.status())
}

fn do_open_profile(
    state: &State<'_, AppState>,
    profile_id: &str,
) -> Result<OpenProfileResponse, String> {
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    profile_service
        .ensure_profile_openable(profile_id)
        .map_err(error_to_string)?;

    let session = engine_manager
        .open_profile(profile_id)
        .map_err(error_to_string)?;

    let profile = match profile_service.mark_profile_running(profile_id, true) {
        Ok(profile) => profile,
        Err(err) => {
            let _ = engine_manager.close_profile(profile_id);
            return Err(error_to_string(err));
        }
    };

    Ok(OpenProfileResponse { profile, session })
}

fn do_close_profile(state: &State<'_, AppState>, profile_id: &str) -> Result<Profile, String> {
    let mut profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    profile_service
        .ensure_profile_closable(profile_id)
        .map_err(error_to_string)?;

    engine_manager
        .close_profile(profile_id)
        .map_err(error_to_string)?;

    profile_service
        .mark_profile_running(profile_id, false)
        .map_err(error_to_string)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}
