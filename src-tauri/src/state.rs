use std::sync::Mutex;

use tauri::AppHandle;

use crate::engine_manager::EngineManager;
use crate::error::AppResult;
use crate::local_api_server::LocalApiServer;
use crate::services::profile_service::ProfileService;

pub struct AppState {
    pub profile_service: Mutex<ProfileService>,
    pub engine_manager: Mutex<EngineManager>,
    pub local_api_server: Mutex<LocalApiServer>,
}

pub fn build_app_state(app: &AppHandle) -> AppResult<AppState> {
    let profile_service = ProfileService::from_app_handle(app)?;
    let engine_manager = EngineManager::new();
    let mut local_api_server = LocalApiServer::new("127.0.0.1:18180");
    local_api_server.ensure_started();

    Ok(AppState {
        profile_service: Mutex::new(profile_service),
        engine_manager: Mutex::new(engine_manager),
        local_api_server: Mutex::new(local_api_server),
    })
}
