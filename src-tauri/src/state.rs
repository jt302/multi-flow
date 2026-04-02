use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use tauri::AppHandle;
use tauri::Manager;

use crate::db;
use crate::engine_manager::EngineManager;
use crate::error::AppResult;
use crate::local_api_server::{LocalApiServer, DEFAULT_PROXY_DAEMON_BIND_ADDRESS};
use crate::logger;
use crate::runtime_guard;
use crate::services::ai_tools::dialog_tools::AiDialogResponse;
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

pub struct AppState {
    /// oneshot senders for WaitForUser steps: run_id → sender(Option<String>)
    /// Some(input) = 用户提交输入后继续，None = 取消
    pub active_run_channels: Mutex<HashMap<String, tokio::sync::oneshot::Sender<Option<String>>>>,
    /// 取消标志: run_id → true 表示该 run 已被取消
    pub cancel_tokens: Mutex<HashMap<String, bool>>,
    /// AI Dialog oneshot senders: request_id → sender(AiDialogResponse)
    pub ai_dialog_channels: Mutex<HashMap<String, tokio::sync::oneshot::Sender<AiDialogResponse>>>,
    pub automation_service: Mutex<AutomationService>,
    pub profile_group_service: Mutex<ProfileGroupService>,
    pub profile_service: Mutex<ProfileService>,
    pub device_preset_service: Mutex<DevicePresetService>,
    pub app_preference_service: Mutex<AppPreferenceService>,
    pub plugin_package_service: Mutex<PluginPackageService>,
    pub engine_session_service: Mutex<EngineSessionService>,
    pub proxy_service: Mutex<ProxyService>,
    pub resource_service: Mutex<ResourceService>,
    pub engine_manager: Mutex<EngineManager>,
    pub local_api_server: Mutex<LocalApiServer>,
    pub chromium_magic_adapter_service: Mutex<ChromiumMagicAdapterService>,
    pub sync_manager_service: Mutex<SyncManagerService>,
    pub require_real_engine: bool,
}

impl AppState {
    pub fn lock_automation_service(&self) -> MutexGuard<'_, AutomationService> {
        recover_lock(&self.automation_service, "state", "automation service")
    }

    pub fn lock_profile_service(&self) -> MutexGuard<'_, ProfileService> {
        recover_lock(&self.profile_service, "state", "profile service")
    }

    pub fn lock_device_preset_service(&self) -> MutexGuard<'_, DevicePresetService> {
        recover_lock(
            &self.device_preset_service,
            "state",
            "device preset service",
        )
    }

    pub fn lock_engine_session_service(&self) -> MutexGuard<'_, EngineSessionService> {
        recover_lock(
            &self.engine_session_service,
            "state",
            "engine session service",
        )
    }

    pub fn lock_proxy_service(&self) -> MutexGuard<'_, ProxyService> {
        recover_lock(&self.proxy_service, "state", "proxy service")
    }

    pub fn lock_resource_service(&self) -> MutexGuard<'_, ResourceService> {
        recover_lock(&self.resource_service, "state", "resource service")
    }

    pub fn lock_engine_manager(&self) -> MutexGuard<'_, EngineManager> {
        recover_lock(&self.engine_manager, "state", "engine manager")
    }

    pub fn lock_local_api_server(&self) -> MutexGuard<'_, LocalApiServer> {
        recover_lock(&self.local_api_server, "state", "local api server")
    }

    pub fn lock_chromium_magic_adapter_service(
        &self,
    ) -> MutexGuard<'_, ChromiumMagicAdapterService> {
        recover_lock(
            &self.chromium_magic_adapter_service,
            "state",
            "chromium magic adapter service",
        )
    }

    pub fn lock_sync_manager_service(&self) -> MutexGuard<'_, SyncManagerService> {
        recover_lock(&self.sync_manager_service, "state", "sync manager service")
    }
}

fn recover_lock<'a, T>(
    mutex: &'a Mutex<T>,
    scope: &'static str,
    target: &'static str,
) -> MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            logger::warn(
                scope,
                format!("{target} lock poisoned, recovering inner state"),
            );
            poisoned.into_inner()
        }
    }
}

pub fn build_app_state(app: &AppHandle) -> AppResult<AppState> {
    let db = db::init_database(app)?;
    let automation_service = AutomationService::from_db(db.clone());
    let profile_group_service = ProfileGroupService::from_db(db.clone());
    let profile_service = ProfileService::from_db(db.clone());
    let device_preset_service = DevicePresetService::from_db(db.clone());
    let app_preference_service = AppPreferenceService::from_app_handle(app)?;
    let plugin_package_service = PluginPackageService::from_db(db.clone());
    let engine_session_service = EngineSessionService::from_db(db.clone());
    let proxy_service = ProxyService::from_db(db.clone());
    let resource_service = ResourceService::from_app_handle(app)?;
    let engine_manager = build_engine_manager(app)?;
    let local_api_server = LocalApiServer::new(DEFAULT_PROXY_DAEMON_BIND_ADDRESS);
    let chromium_magic_adapter_service = ChromiumMagicAdapterService::new();
    let sync_manager_service = SyncManagerService::new(None, None);
    cleanup_rpa_artifacts_dir(app)?;

    let app_state = AppState {
        active_run_channels: Mutex::new(HashMap::new()),
        cancel_tokens: Mutex::new(HashMap::new()),
        ai_dialog_channels: Mutex::new(HashMap::new()),
        automation_service: Mutex::new(automation_service),
        profile_group_service: Mutex::new(profile_group_service),
        profile_service: Mutex::new(profile_service),
        device_preset_service: Mutex::new(device_preset_service),
        app_preference_service: Mutex::new(app_preference_service),
        plugin_package_service: Mutex::new(plugin_package_service),
        engine_session_service: Mutex::new(engine_session_service),
        proxy_service: Mutex::new(proxy_service),
        resource_service: Mutex::new(resource_service),
        engine_manager: Mutex::new(engine_manager),
        local_api_server: Mutex::new(local_api_server),
        chromium_magic_adapter_service: Mutex::new(chromium_magic_adapter_service),
        sync_manager_service: Mutex::new(sync_manager_service),
        require_real_engine: true,
    };
    let affected = runtime_guard::reconcile_runtime_state(&app_state)?;
    logger::info(
        "state",
        format!("startup runtime state reconciled, affected={affected}"),
    );

    Ok(app_state)
}

fn build_engine_manager(app: &AppHandle) -> AppResult<EngineManager> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| {
            crate::error::AppError::Validation(format!("failed to resolve app data dir: {err}"))
        })?;
    fs::create_dir_all(&data_dir)?;

    let profiles_root = data_dir.join("profiles");
    fs::create_dir_all(&profiles_root)?;

    let mut manager = EngineManager::with_profiles_root(profiles_root);
    manager.set_chromium_executable(resolve_chromium_executable(&data_dir));

    Ok(manager)
}

fn cleanup_rpa_artifacts_dir(app: &AppHandle) -> AppResult<()> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| {
            crate::error::AppError::Validation(format!("failed to resolve app data dir: {err}"))
        })?;
    fs::create_dir_all(&data_dir)?;
    let artifacts_dir = data_dir.join("rpa-artifacts");
    if artifacts_dir.exists() {
        fs::remove_dir_all(&artifacts_dir)?;
        logger::info(
            "state",
            format!(
                "removed legacy rpa artifacts directory: {}",
                artifacts_dir.display()
            ),
        );
    }
    Ok(())
}

fn resolve_chromium_executable(data_dir: &Path) -> Option<PathBuf> {
    if let Ok(custom_path) = env::var("MULTI_FLOW_CHROMIUM_EXECUTABLE") {
        let candidate = PathBuf::from(custom_path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    let candidates = [
        data_dir.join("chromium/current/Chromium.app/Contents/MacOS/Chromium"),
        data_dir.join("chromium/current/Contents/MacOS/Chromium"),
        data_dir.join("chromium/Chromium.app/Contents/MacOS/Chromium"),
        data_dir.join("chromium/chrome"),
        data_dir.join("chromium/chromium"),
    ];

    candidates.into_iter().find(|path| path.is_file())
}
