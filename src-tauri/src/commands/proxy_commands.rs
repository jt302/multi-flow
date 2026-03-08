use tauri::State;

use crate::error::AppError;
use crate::models::{
    CreateProxyRequest, ListProxiesQuery, ListProxiesResponse, ProfileProxyBinding, Proxy,
};
use crate::state::AppState;

#[tauri::command]
pub fn create_proxy(
    state: State<'_, AppState>,
    payload: CreateProxyRequest,
) -> Result<Proxy, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service.create_proxy(payload).map_err(error_to_string)
}

#[tauri::command]
pub fn list_proxies(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
    page: Option<u64>,
    page_size: Option<u64>,
    keyword: Option<String>,
    protocol: Option<String>,
    country: Option<String>,
    last_status: Option<String>,
) -> Result<ListProxiesResponse, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    let query = ListProxiesQuery {
        include_deleted: include_deleted.unwrap_or(false),
        page: page.unwrap_or(1),
        page_size: page_size.unwrap_or(50),
        keyword,
        protocol,
        country,
        last_status,
    };

    proxy_service.list_proxies(query).map_err(error_to_string)
}

#[tauri::command]
pub fn delete_proxy(state: State<'_, AppState>, proxy_id: String) -> Result<Proxy, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .soft_delete_proxy(&proxy_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn restore_proxy(state: State<'_, AppState>, proxy_id: String) -> Result<Proxy, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .restore_proxy(&proxy_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn bind_profile_proxy(
    state: State<'_, AppState>,
    profile_id: String,
    proxy_id: String,
) -> Result<ProfileProxyBinding, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .bind_profile_proxy(&profile_id, &proxy_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn unbind_profile_proxy(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileProxyBinding, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .unbind_profile_proxy(&profile_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn get_profile_proxy(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Option<Proxy>, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .get_profile_proxy(&profile_id)
        .map_err(error_to_string)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}
