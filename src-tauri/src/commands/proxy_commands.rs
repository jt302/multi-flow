use tauri::State;

use crate::error::AppError;
use crate::models::{
    BatchCheckProxiesRequest, BatchDeleteProxiesRequest, BatchProxyActionResponse,
    BatchUpdateProxiesRequest, CreateProxyRequest, ImportProxiesRequest, ListProxiesQuery,
    ListProxiesResponse, ProfileProxyBinding, Proxy, UpdateProxyRequest,
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
pub fn update_proxy(
    state: State<'_, AppState>,
    proxy_id: String,
    payload: UpdateProxyRequest,
) -> Result<Proxy, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .update_proxy(&proxy_id, payload)
        .map_err(error_to_string)
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
pub fn batch_update_proxies(
    state: State<'_, AppState>,
    payload: BatchUpdateProxiesRequest,
) -> Result<BatchProxyActionResponse, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .batch_update_proxies(payload.proxy_ids, payload.payload)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn batch_delete_proxies(
    state: State<'_, AppState>,
    payload: BatchDeleteProxiesRequest,
) -> Result<BatchProxyActionResponse, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .batch_delete_proxies(payload.proxy_ids)
        .map_err(error_to_string)
}


#[tauri::command]
pub fn import_proxies(
    state: State<'_, AppState>,
    payload: ImportProxiesRequest,
) -> Result<BatchProxyActionResponse, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service.import_proxies(payload).map_err(error_to_string)
}

#[tauri::command]
pub fn check_proxy(state: State<'_, AppState>, proxy_id: String) -> Result<Proxy, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service.check_proxy(&proxy_id).map_err(error_to_string)
}

#[tauri::command]
pub fn batch_check_proxies(
    state: State<'_, AppState>,
    payload: BatchCheckProxiesRequest,
) -> Result<BatchProxyActionResponse, String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service.batch_check_proxies(payload).map_err(error_to_string)
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
