use std::process::Command;

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::ProfileLifecycle;
use crate::state::AppState;

pub fn reconcile_runtime_state(state: &AppState) -> AppResult<usize> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| lock_poisoned("profile service"))?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| lock_poisoned("engine session service"))?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| lock_poisoned("engine manager"))?;

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
    for profile_id in running_profile_ids {
        if engine_manager.is_running(&profile_id) {
            continue;
        }

        let keep_running = match engine_session_service.get_session(&profile_id)? {
            Some(session) => session.pid.map(is_process_alive).unwrap_or(false),
            None => false,
        };
        if keep_running {
            continue;
        }

        engine_session_service.delete_session(&profile_id)?;
        let _ = profile_service.mark_profile_running(&profile_id, false)?;
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

fn lock_poisoned(target: &str) -> AppError {
    AppError::Validation(format!("{target} lock poisoned"))
}
