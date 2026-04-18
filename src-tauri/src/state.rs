use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use tauri::AppHandle;
use tauri::Manager;

use crate::db;
use crate::engine_manager::EngineManager;
use crate::error::AppResult;
use crate::local_api_server::{LocalApiServer, DEFAULT_PROXY_DAEMON_BIND_ADDRESS};
use crate::logger;
use crate::runtime_guard;
use crate::services::ai_tools::dialog_tools::AiDialogResponse;
use crate::models::{ArrangementSnapshotItem, ResourceProgressSnapshot};
use crate::services::automation_context::ActiveRunRegistry;
use crate::services::app_preference_service::AppPreferenceService;
use crate::services::automation_service::AutomationService;
use crate::services::chat_service::ChatService;
use crate::services::chromium_magic_adapter_service::ChromiumMagicAdapterService;
use crate::services::device_preset_service::DevicePresetService;
use crate::services::engine_session_service::EngineSessionService;
use crate::services::plugin_package_service::PluginPackageService;
use crate::services::profile_group_service::ProfileGroupService;
use crate::services::profile_service::ProfileService;
use crate::services::proxy_service::ProxyService;
use crate::services::resource_service::ResourceService;
use crate::services::mcp::McpManager;
use crate::services::sync_manager_service::SyncManagerService;

const DEV_APP_DATA_DIR_NAME: &str = "dev";

pub struct AppState {
    /// 活跃运行上下文注册表：run_id → ActiveRunCtx，供 emit helpers 反查 profile 信息
    pub active_runs: Arc<ActiveRunRegistry>,
    /// oneshot senders for WaitForUser steps: run_id → sender(Option<String>)
    /// Some(input) = 用户提交输入后继续，None = 取消
    pub active_run_channels: Mutex<HashMap<String, tokio::sync::oneshot::Sender<Option<String>>>>,
    /// 取消标志: run_id → true 表示该 run 已被取消
    pub cancel_tokens: Mutex<HashMap<String, bool>>,
    /// AI Dialog oneshot senders: request_id → sender(AiDialogResponse)
    pub ai_dialog_channels: Mutex<HashMap<String, tokio::sync::oneshot::Sender<AiDialogResponse>>>,
    /// Tool confirmation oneshot senders: request_id → sender(bool)
    pub tool_confirmation_channels: Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>,
    pub chat_service: Mutex<ChatService>,
    /// 聊天生成取消标志: session_id → true
    pub chat_cancel_tokens: Mutex<HashMap<String, bool>>,
    pub automation_service: Mutex<AutomationService>,
    pub profile_group_service: Mutex<ProfileGroupService>,
    pub profile_service: Mutex<ProfileService>,
    pub device_preset_service: Mutex<DevicePresetService>,
    pub app_preference_service: Mutex<AppPreferenceService>,
    pub plugin_package_service: Mutex<PluginPackageService>,
    pub engine_session_service: Mutex<EngineSessionService>,
    pub proxy_service: Mutex<ProxyService>,
    pub resource_service: Mutex<ResourceService>,
    /// 进行中的资源下载任务快照：task_id → 最新进度。
    /// 用于前端组件重新挂载或 webview 刷新后恢复下载状态。
    pub active_resource_downloads: Mutex<HashMap<String, ResourceProgressSnapshot>>,
    pub engine_manager: Mutex<EngineManager>,
    pub local_api_server: Mutex<LocalApiServer>,
    pub chromium_magic_adapter_service: Mutex<ChromiumMagicAdapterService>,
    pub sync_manager_service: Mutex<SyncManagerService>,
    /// MCP 服务器管理器（Arc 而非 Mutex，因为内部已有 tokio::sync::Mutex）
    pub mcp_manager: std::sync::Arc<McpManager>,
    pub require_real_engine: bool,
    /// 上一次窗口排布前的 bounds 快照，供"撤销上次"使用
    pub last_arrangement_snapshot: Mutex<Vec<ArrangementSnapshotItem>>,
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
    let chat_service = ChatService::from_db(db.clone());
    let automation_service = AutomationService::from_db(db.clone());
    let mcp_manager = std::sync::Arc::new(McpManager::from_db(db.clone()));
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
    ensure_app_fs_root(app)?;
    cleanup_rpa_artifacts_dir(app)?;

    let app_state = AppState {
        active_runs: Arc::new(ActiveRunRegistry::new()),
        active_run_channels: Mutex::new(HashMap::new()),
        cancel_tokens: Mutex::new(HashMap::new()),
        ai_dialog_channels: Mutex::new(HashMap::new()),
        tool_confirmation_channels: Mutex::new(HashMap::new()),
        chat_service: Mutex::new(chat_service),
        chat_cancel_tokens: Mutex::new(HashMap::new()),
        automation_service: Mutex::new(automation_service),
        profile_group_service: Mutex::new(profile_group_service),
        profile_service: Mutex::new(profile_service),
        device_preset_service: Mutex::new(device_preset_service),
        app_preference_service: Mutex::new(app_preference_service),
        plugin_package_service: Mutex::new(plugin_package_service),
        engine_session_service: Mutex::new(engine_session_service),
        proxy_service: Mutex::new(proxy_service),
        resource_service: Mutex::new(resource_service),
        active_resource_downloads: Mutex::new(HashMap::new()),
        engine_manager: Mutex::new(engine_manager),
        local_api_server: Mutex::new(local_api_server),
        chromium_magic_adapter_service: Mutex::new(chromium_magic_adapter_service),
        sync_manager_service: Mutex::new(sync_manager_service),
        mcp_manager,
        require_real_engine: true,
        last_arrangement_snapshot: Mutex::new(Vec::new()),
    };
    let affected = runtime_guard::reconcile_runtime_state(&app_state)?;
    logger::info(
        "state",
        format!("startup runtime state reconciled, affected={affected}"),
    );

    Ok(app_state)
}

fn build_engine_manager(app: &AppHandle) -> AppResult<EngineManager> {
    let data_dir = resolve_app_data_dir(app)?;
    fs::create_dir_all(&data_dir)?;

    let profiles_root = data_dir.join("profiles");
    fs::create_dir_all(&profiles_root)?;

    let mut manager = EngineManager::with_profiles_root(profiles_root);
    manager.set_chromium_executable(resolve_chromium_executable(&data_dir));

    Ok(manager)
}

fn cleanup_rpa_artifacts_dir(app: &AppHandle) -> AppResult<()> {
    let data_dir = resolve_app_data_dir(app)?;
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

pub fn resolve_app_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(resolve_runtime_app_data_dir(
        app.path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| {
            crate::error::AppError::Validation(format!("failed to resolve app data dir: {err}"))
        })?,
        cfg!(debug_assertions),
    ))
}

pub(crate) fn resolve_runtime_app_data_dir(base_dir: PathBuf, is_dev: bool) -> PathBuf {
    if is_dev {
        base_dir.join(DEV_APP_DATA_DIR_NAME)
    } else {
        base_dir
    }
}

pub fn ensure_app_fs_root(app: &AppHandle) -> AppResult<PathBuf> {
    let data_dir = resolve_app_data_dir(app)?;
    fs::create_dir_all(&data_dir)?;

    let fs_root = data_dir.join("fs");
    fs::create_dir_all(&fs_root)?;

    Ok(fs_root)
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

#[cfg(test)]
mod tests {
    use super::resolve_runtime_app_data_dir;
    use std::path::PathBuf;

    #[test]
    fn resolve_runtime_app_data_dir_separates_dev_and_release() {
        let base_dir = PathBuf::from("/tmp/multi-flow");

        assert_eq!(
            resolve_runtime_app_data_dir(base_dir.clone(), true),
            base_dir.join("dev")
        );
        assert_eq!(resolve_runtime_app_data_dir(base_dir.clone(), false), base_dir);
    }
}
