use std::process::Command;

use crate::error::AppResult;
use crate::logger;
use crate::models::ProfileLifecycle;
use crate::state::AppState;

pub fn reconcile_runtime_state(state: &AppState) -> AppResult<usize> {
    let profile_service = state.lock_profile_service();
    let engine_session_service = state.lock_engine_session_service();
    let mut engine_manager = state.lock_engine_manager();

    let mut affected = 0usize;

    for profile_id in engine_manager.prune_exited_sessions() {
        engine_session_service.delete_session(&profile_id)?;
        let _ = profile_service.mark_profile_running(&profile_id, false)?;
        logger::info(
            "runtime_guard",
            format!("pruned exited in-memory session profile_id={profile_id}"),
        );
        affected += 1;
    }

    let persisted_sessions = engine_session_service.list_sessions()?;
    for session in persisted_sessions {
        if engine_manager.is_running(&session.profile_id) {
            continue;
        }

        let process_alive = session.pid.map(is_process_alive).unwrap_or(false);
        if process_alive {
            match profile_service.get_profile(&session.profile_id) {
                Ok(profile) if matches!(profile.lifecycle, ProfileLifecycle::Deleted) => {
                    engine_session_service.delete_session(&session.profile_id)?;
                    logger::warn(
                        "runtime_guard",
                        format!(
                            "removed persisted session for deleted profile profile_id={} pid={:?}",
                            session.profile_id, session.pid
                        ),
                    );
                    affected += 1;
                }
                Ok(profile) => {
                    if !profile.running {
                        let _ = profile_service.mark_profile_running(&session.profile_id, true)?;
                        logger::info(
                            "runtime_guard",
                            format!(
                                "restored running status from persisted session profile_id={} pid={:?}",
                                session.profile_id, session.pid
                            ),
                        );
                        affected += 1;
                    }
                    // 将 session 恢复到 EngineManager 内存中，使 CDP/Magic 工具可用
                    engine_manager.restore_session(session.clone(), profile.name.clone());
                    logger::info(
                        "runtime_guard",
                        format!(
                            "restored engine session to memory profile_id={} debug_port={:?} magic_port={:?}",
                            session.profile_id, session.debug_port, session.magic_port
                        ),
                    );
                }
                Err(err) => {
                    engine_session_service.delete_session(&session.profile_id)?;
                    logger::warn(
                        "runtime_guard",
                        format!(
                            "removed persisted session because profile lookup failed profile_id={}: {err}",
                            session.profile_id
                        ),
                    );
                    affected += 1;
                }
            }
            continue;
        }

        engine_session_service.delete_session(&session.profile_id)?;
        match profile_service.get_profile(&session.profile_id) {
            Ok(profile) if profile.running => {
                let _ = profile_service.mark_profile_running(&session.profile_id, false)?;
                logger::info(
                    "runtime_guard",
                    format!(
                        "cleared stale persisted session profile_id={} pid={:?}",
                        session.profile_id, session.pid
                    ),
                );
                affected += 1;
            }
            Ok(_) => {
                logger::info(
                    "runtime_guard",
                    format!(
                        "removed stale persisted session profile_id={} pid={:?}",
                        session.profile_id, session.pid
                    ),
                );
                affected += 1;
            }
            Err(err) => {
                logger::warn(
                    "runtime_guard",
                    format!(
                        "remove stale session done but loading profile failed profile_id={}: {err}",
                        session.profile_id
                    ),
                );
                affected += 1;
            }
        }
    }

    let running_profile_ids = profile_service.list_running_profile_ids()?;

    // Clean up stale automation runs (status=running but app restarted)
    {
        let automation_service = state.lock_automation_service();
        match automation_service.cleanup_stale_runs() {
            Ok(n) if n > 0 => {
                logger::info(
                    "runtime_guard",
                    format!("marked {n} stale automation run(s) as interrupted"),
                );
                affected += n;
            }
            Err(e) => {
                logger::warn(
                    "runtime_guard",
                    format!("failed to cleanup stale automation runs: {e}"),
                );
            }
            _ => {}
        }
    }

    for profile_id in &running_profile_ids {
        if engine_manager.is_running(profile_id) {
            continue;
        }

        let keep_running = match engine_session_service.get_session(profile_id)? {
            Some(session) => session.pid.map(is_process_alive).unwrap_or(false),
            None => false,
        };
        if keep_running {
            continue;
        }

        engine_session_service.delete_session(profile_id)?;
        let _ = profile_service.mark_profile_running(profile_id, false)?;
        logger::info(
            "runtime_guard",
            format!("cleared stale running status profile_id={profile_id}"),
        );
        affected += 1;
    }

    Ok(affected)
}

pub fn is_process_alive(pid: u32) -> bool {
    let pid_str = pid.to_string();
    #[cfg(unix)]
    {
        return Command::new("kill")
            .args(["-0", pid_str.as_str()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
    }
    #[cfg(windows)]
    {
        return Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}")])
            .output()
            .map(|output| {
                output.status.success()
                    && String::from_utf8_lossy(&output.stdout).contains(pid_str.as_str())
            })
            .unwrap_or(false);
    }
    #[allow(unreachable_code)]
    false
}

pub fn terminate_process(pid: u32) {
    let pid_str = pid.to_string();
    #[cfg(unix)]
    {
        let _ = Command::new("kill")
            .args(["-TERM", pid_str.as_str()])
            .status();
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", pid_str.as_str(), "/T", "/F"])
            .status();
    }
}

#[cfg(test)]
mod tests {
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
        let resource_dir =
            std::env::temp_dir().join(format!("multi-flow-runtime-guard-test-{unique}"));
        let resource_service =
            ResourceService::from_data_dir(&resource_dir).expect("resource service");
        let app_preference_service = AppPreferenceService::from_data_dir(resource_dir.clone());
        let mut local_api_server = LocalApiServer::new("127.0.0.1:18180");
        local_api_server.mark_started();

        AppState {
            active_runs: std::sync::Arc::new(
                crate::services::automation_context::ActiveRunRegistry::new(),
            ),
            active_run_channels: Mutex::new(std::collections::HashMap::new()),
            cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            ai_dialog_channels: Mutex::new(std::collections::HashMap::new()),
            tool_confirmation_channels: Mutex::new(std::collections::HashMap::new()),
            chat_service: Mutex::new(crate::services::chat_service::ChatService::from_db(
                db.clone(),
            )),
            chat_cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            automation_service: Mutex::new(AutomationService::from_db(db.clone())),
            profile_group_service: Mutex::new(profile_group_service),
            profile_service: Mutex::new(profile_service),
            device_preset_service: Mutex::new(device_preset_service),
            app_preference_service: Mutex::new(app_preference_service),
            plugin_package_service: Mutex::new(plugin_package_service),
            engine_session_service: Mutex::new(engine_session_service),
            proxy_service: Mutex::new(proxy_service),
            resource_service: Mutex::new(resource_service),
            active_resource_downloads: Mutex::new(std::collections::HashMap::new()),
            engine_manager: Mutex::new(EngineManager::new()),
            local_api_server: Mutex::new(local_api_server),
            chromium_magic_adapter_service: Mutex::new(ChromiumMagicAdapterService::new()),
            sync_manager_service: Mutex::new(SyncManagerService::new_mock(None, None)),
            mcp_manager: std::sync::Arc::new(crate::services::mcp::McpManager::from_db(db.clone())),
            require_real_engine: false,
            last_arrangement_snapshot: Mutex::new(Vec::new()),
            host_locale_service: std::sync::Arc::new(
                crate::services::host_locale_service::HostLocaleService::new(|| None),
            ),
        }
    }

    #[test]
    fn reconcile_runtime_state_recovers_from_poisoned_profile_service_lock() {
        let state = new_test_state();
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state.profile_service.lock().expect("profile service lock");
            panic!("poison profile service lock");
        }));

        let result = super::reconcile_runtime_state(&state);

        assert!(
            result.is_ok(),
            "expected poisoned profile service lock to recover, got {result:?}"
        );
    }
}
