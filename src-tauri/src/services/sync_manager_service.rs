use std::thread;
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio_tungstenite::tungstenite::connect;

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::EnsureSyncSidecarStartedResponse;

const SYNC_MANAGER_SIDECAR_NAME: &str = "sync-manager";
const SYNC_MANAGER_RUST_LOG_ENV: &str = "MULTI_FLOW_SYNC_MANAGER_RUST_LOG";
const DEFAULT_SYNC_MANAGER_RUST_LOG: &str = "info";
const DEFAULT_SYNC_MANAGER_BIND_HOST: &str = "127.0.0.1";
pub const DEFAULT_SYNC_MANAGER_PORT: u16 = 18181;
const STARTUP_RETRY_COUNT: usize = 30;
const STARTUP_RETRY_DELAY_MS: u64 = 120;

enum SyncManagerMode {
    Real {
        bind_host: String,
        port: u16,
        started: bool,
    },
    #[cfg(test)]
    Mock { port: u16, started: bool },
}

pub struct SyncManagerService {
    mode: SyncManagerMode,
}

impl SyncManagerService {
    pub fn new(bind_host: Option<&str>, port: Option<u16>) -> Self {
        Self {
            mode: SyncManagerMode::Real {
                bind_host: bind_host
                    .unwrap_or(DEFAULT_SYNC_MANAGER_BIND_HOST)
                    .to_string(),
                port: port.unwrap_or(DEFAULT_SYNC_MANAGER_PORT),
                started: false,
            },
        }
    }

    #[cfg(test)]
    pub fn new_mock(bind_host: Option<&str>, port: Option<u16>) -> Self {
        let _ = bind_host;
        Self {
            mode: SyncManagerMode::Mock {
                port: port.unwrap_or(DEFAULT_SYNC_MANAGER_PORT),
                started: false,
            },
        }
    }

    pub fn ensure_started(
        &mut self,
        app: Option<&AppHandle>,
    ) -> AppResult<EnsureSyncSidecarStartedResponse> {
        match &mut self.mode {
            #[cfg(test)]
            SyncManagerMode::Mock { port, started } => {
                let response = EnsureSyncSidecarStartedResponse {
                    port: *port,
                    already_running: *started,
                };
                *started = true;
                Ok(response)
            }
            SyncManagerMode::Real {
                bind_host,
                port,
                started,
            } => {
                logger::info(
                    "sync_manager",
                    format!(
                        "ensure_started begin host={} port={} started={}",
                        bind_host, port, started
                    ),
                );
                if *started {
                    return Ok(EnsureSyncSidecarStartedResponse {
                        port: *port,
                        already_running: true,
                    });
                }

                if is_sidecar_ready(bind_host.as_str(), *port) {
                    *started = true;
                    logger::info(
                        "sync_manager",
                        format!(
                            "sync manager already reachable at {}:{}, skip sidecar spawn",
                            bind_host, port
                        ),
                    );
                    return Ok(EnsureSyncSidecarStartedResponse {
                        port: *port,
                        already_running: true,
                    });
                }

                let app = app.ok_or_else(|| {
                    logger::warn(
                        "sync_manager",
                        format!(
                            "ensure_started failed host={} port={} because app handle is unavailable",
                            bind_host, port
                        ),
                    );
                    AppError::Validation(
                        "sync manager sidecar is not running and app handle is unavailable"
                            .to_string(),
                    )
                })?;
                spawn_sync_manager_sidecar(app, bind_host.as_str(), *port)?;

                for _ in 0..STARTUP_RETRY_COUNT {
                    if is_sidecar_ready(bind_host.as_str(), *port) {
                        *started = true;
                        logger::info(
                            "sync_manager",
                            format!(
                                "sync manager sidecar started at ws://{}:{}",
                                bind_host, port
                            ),
                        );
                        return Ok(EnsureSyncSidecarStartedResponse {
                            port: *port,
                            already_running: false,
                        });
                    }
                    thread::sleep(Duration::from_millis(STARTUP_RETRY_DELAY_MS));
                }

                logger::warn(
                    "sync_manager",
                    format!(
                        "sync manager sidecar probe timed out at ws://{}:{}",
                        bind_host, port
                    ),
                );
                Err(AppError::Validation(format!(
                    "sync manager sidecar started but port probe timed out at ws://{}:{}",
                    bind_host, port
                )))
            }
        }
    }
}

fn spawn_sync_manager_sidecar(app: &AppHandle, bind_host: &str, port: u16) -> AppResult<()> {
    let daemon_log_level = std::env::var(SYNC_MANAGER_RUST_LOG_ENV)
        .ok()
        .as_deref()
        .and_then(trim_to_option)
        .unwrap_or_else(|| DEFAULT_SYNC_MANAGER_RUST_LOG.to_string());
    let sidecar_command = app
        .shell()
        .sidecar(SYNC_MANAGER_SIDECAR_NAME)
        .map_err(|err| {
            logger::error(
                "sync_manager",
                format!("resolve sync manager sidecar failed host={} port={} err={err}", bind_host, port),
            );
            AppError::Validation(format!("resolve sync manager sidecar failed: {err}"))
        })?;
    let (mut events, child) = sidecar_command
        .env("RUST_LOG", daemon_log_level.as_str())
        .args(["--port", port.to_string().as_str()])
        .spawn()
        .map_err(|err| {
            logger::error(
                "sync_manager",
                format!("spawn sync manager sidecar failed host={} port={} err={err}", bind_host, port),
            );
            AppError::Validation(format!("spawn sync manager sidecar failed: {err}"))
        })?;

    logger::info(
        "sync_manager",
        format!(
            "sync manager sidecar spawn requested pid={} host={} port={} rust_log={}",
            child.pid(),
            bind_host,
            port,
            daemon_log_level
        ),
    );

    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if let Some(line) = sidecar_line(bytes.as_slice()) {
                        logger::info("sync_manager.stdout", line);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    if let Some(line) = sidecar_line(bytes.as_slice()) {
                        logger::warn("sync_manager.stderr", line);
                    }
                }
                CommandEvent::Error(err) => {
                    logger::error("sync_manager", format!("sidecar event stream error: {err}"));
                }
                CommandEvent::Terminated(payload) => {
                    logger::warn(
                        "sync_manager",
                        format!(
                            "sync manager terminated code={:?} signal={:?}",
                            payload.code, payload.signal
                        ),
                    );
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn is_sidecar_ready(host: &str, port: u16) -> bool {
    let endpoint = format!("ws://{host}:{port}/");
    connect(endpoint.as_str()).is_ok()
}

fn sidecar_line(bytes: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(bytes).trim().to_string();
    trim_to_option(&text)
}

fn trim_to_option(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    use tokio_tungstenite::tungstenite::accept;

    #[test]
    fn sidecar_ready_probe_rejects_raw_tcp_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind raw listener");
        let port = listener.local_addr().expect("addr").port();
        let server = thread::spawn(move || {
            let _ = listener.accept();
        });

        assert!(!is_sidecar_ready("127.0.0.1", port));
        let _ = server.join();
    }

    #[test]
    fn sidecar_ready_probe_accepts_real_websocket_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ws listener");
        let port = listener.local_addr().expect("addr").port();
        let server = thread::spawn(move || {
            if let Ok((stream, _)) = listener.accept() {
                let mut websocket = accept(stream).expect("accept websocket");
                let _ = websocket.close(None);
            }
        });

        assert!(is_sidecar_ready("127.0.0.1", port));
        let _ = server.join();
    }

    #[test]
    fn trim_to_option_strips_empty_values() {
        assert_eq!(trim_to_option("  "), None);
        assert_eq!(trim_to_option(" abc "), Some("abc".to_string()));
    }
}
