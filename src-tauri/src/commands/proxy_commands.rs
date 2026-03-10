use tauri::State;

use crate::error::AppError;
use crate::logger;
use crate::models::{
    BatchCheckProxiesRequest, BatchDeleteProxiesRequest, BatchProxyActionResponse,
    BatchUpdateProxiesRequest, CreateProxyRequest, ImportProxiesRequest, ListProxiesQuery,
    ListProxiesResponse, ProfileProxyBinding, Proxy, UpdateProxyRequest,
};
use crate::state::AppState;

#[tauri::command]
pub async fn create_proxy(
    state: State<'_, AppState>,
    payload: CreateProxyRequest,
) -> Result<Proxy, String> {
    let proxy_service = {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service.clone()
    };
    let created = run_proxy_service_blocking("proxy create", move || {
        proxy_service.create_proxy(payload).map_err(error_to_string)
    })
    .await?;
    auto_check_proxy_if_needed(&state, created).await
}

#[tauri::command]
pub async fn update_proxy(
    state: State<'_, AppState>,
    proxy_id: String,
    payload: UpdateProxyRequest,
) -> Result<Proxy, String> {
    let proxy_service = {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service.clone()
    };
    let updated = run_proxy_service_blocking("proxy update", move || {
        proxy_service
            .update_proxy(&proxy_id, payload)
            .map_err(error_to_string)
    })
    .await?;
    auto_check_proxy_if_needed(&state, updated).await
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
    check_status: Option<String>,
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
        check_status,
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
    proxy_service
        .import_proxies(payload)
        .map_err(error_to_string)
}

#[tauri::command]
pub async fn check_proxy(state: State<'_, AppState>, proxy_id: String) -> Result<Proxy, String> {
    let geoip_database = {
        let resource_service = state
            .resource_service
            .lock()
            .map_err(|_| "resource service lock poisoned".to_string())?;
        resource_service
            .ensure_geoip_database_available()
            .map_err(error_to_string)?
    };
    let proxy_service = {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service.clone()
    };
    let handle = tauri::async_runtime::spawn_blocking(move || {
        proxy_service.check_proxy(&proxy_id, &geoip_database)
    });
    handle
        .await
        .map_err(|err| format!("proxy check task join failed: {err}"))?
        .map_err(error_to_string)
}

#[tauri::command]
pub async fn batch_check_proxies(
    state: State<'_, AppState>,
    payload: BatchCheckProxiesRequest,
) -> Result<BatchProxyActionResponse, String> {
    let geoip_database = {
        let resource_service = state
            .resource_service
            .lock()
            .map_err(|_| "resource service lock poisoned".to_string())?;
        resource_service
            .ensure_geoip_database_available()
            .map_err(error_to_string)?
    };
    let proxy_service = {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service.clone()
    };
    let handle = tauri::async_runtime::spawn_blocking(move || {
        proxy_service.batch_check_proxies(payload, &geoip_database)
    });
    handle
        .await
        .map_err(|err| format!("proxy batch check task join failed: {err}"))?
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
pub fn purge_proxy(state: State<'_, AppState>, proxy_id: String) -> Result<(), String> {
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    proxy_service
        .purge_proxy(&proxy_id)
        .map_err(error_to_string)?;
    Ok(())
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

async fn run_proxy_service_blocking<T, F>(task_name: &str, task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let handle = tauri::async_runtime::spawn_blocking(task);
    handle
        .await
        .map_err(|err| format!("{task_name} task join failed: {err}"))?
}

async fn auto_check_proxy_if_needed(state: &AppState, proxy: Proxy) -> Result<Proxy, String> {
    if !proxy_uses_ip_defaults(&proxy) {
        return Ok(proxy);
    }

    let geoip_database = {
        let resource_service = state
            .resource_service
            .lock()
            .map_err(|_| "resource service lock poisoned".to_string())?;
        resource_service.resolve_geoip_database_path()
    };
    let Some(geoip_database) = geoip_database else {
        logger::warn(
            "proxy_cmd",
            format!(
                "skip proxy auto-check after save because geoip database is unavailable proxy_id={}",
                proxy.id
            ),
        );
        return Ok(proxy);
    };
    let proxy_service = {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service.clone()
    };
    let proxy_id = proxy.id.clone();
    let handle = tauri::async_runtime::spawn_blocking(move || {
        proxy_service.check_proxy(&proxy_id, &geoip_database)
    });
    match handle
        .await
        .map_err(|err| format!("proxy auto-check task join failed: {err}"))?
    {
        Ok(updated) => Ok(updated),
        Err(err) => {
            logger::warn(
                "proxy_cmd",
                format!(
                    "proxy auto-check failed after save proxy_id={}: {err}",
                    proxy.id
                ),
            );
            Ok(proxy)
        }
    }
}

fn proxy_uses_ip_defaults(proxy: &Proxy) -> bool {
    proxy.language_source.as_deref().unwrap_or("ip") == "ip"
        || proxy.timezone_source.as_deref().unwrap_or("ip") == "ip"
}

#[cfg(test)]
mod tests {
    use super::run_proxy_service_blocking;

    #[test]
    fn run_proxy_service_blocking_allows_nested_block_on_work() {
        let value = tauri::async_runtime::block_on(async {
            run_proxy_service_blocking("proxy-save", || {
                let nested = tauri::async_runtime::block_on(async { 42_u8 });
                Ok::<u8, String>(nested)
            })
            .await
        })
        .expect("proxy-save task should complete");

        assert_eq!(value, 42);
    }

    #[test]
    fn run_proxy_service_blocking_maps_join_error() {
        let err = tauri::async_runtime::block_on(async {
            run_proxy_service_blocking::<(), _>("proxy-save", || -> Result<(), String> {
                panic!("intentional panic");
            })
            .await
        })
        .expect_err("panic in blocking task should surface as error");

        assert!(err.contains("proxy-save task join failed"));
    }
}
