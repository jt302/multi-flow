use tauri::State;

use crate::error::AppError;
use crate::models::{CreateProfileGroupRequest, ListProfileGroupsResponse, ProfileGroup};
use crate::state::AppState;

#[tauri::command]
pub fn create_profile_group(
    state: State<'_, AppState>,
    payload: CreateProfileGroupRequest,
) -> Result<ProfileGroup, String> {
    let service = state
        .profile_group_service
        .lock()
        .map_err(|_| "profile group service lock poisoned".to_string())?;
    service.create_group(payload).map_err(error_to_string)
}

#[tauri::command]
pub fn list_profile_groups(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<ListProfileGroupsResponse, String> {
    let service = state
        .profile_group_service
        .lock()
        .map_err(|_| "profile group service lock poisoned".to_string())?;
    service
        .list_groups(include_deleted.unwrap_or(false))
        .map_err(error_to_string)
}

#[tauri::command]
pub fn delete_profile_group(
    state: State<'_, AppState>,
    group_id: String,
) -> Result<ProfileGroup, String> {
    let service = state
        .profile_group_service
        .lock()
        .map_err(|_| "profile group service lock poisoned".to_string())?;
    service
        .soft_delete_group(&group_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn restore_profile_group(
    state: State<'_, AppState>,
    group_id: String,
) -> Result<ProfileGroup, String> {
    let service = state
        .profile_group_service
        .lock()
        .map_err(|_| "profile group service lock poisoned".to_string())?;
    service.restore_group(&group_id).map_err(error_to_string)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}
