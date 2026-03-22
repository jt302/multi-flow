use std::fs;
use std::process::Command;
use std::thread;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const MENU_ID_OPEN_DATA_DIR: &str = "open_data_dir";
const MENU_ID_OPEN_LOG_PANEL: &str = "open_log_panel";
const PROXY_DAEMON_SIDECAR_NAME: &str = "proxy-daemon";
const PROXY_DAEMON_RUST_LOG_ENV: &str = "MULTI_FLOW_PROXY_DAEMON_RUST_LOG";
const DEFAULT_PROXY_DAEMON_RUST_LOG: &str = "info";

mod commands;
mod db;
mod engine_manager;
mod error;
mod fingerprint_catalog;
mod font_catalog;
mod local_api_server;
mod logger;
mod models;
mod runtime_guard;
mod services;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_menu_event(|app, event| {
            if event.id().as_ref() == MENU_ID_OPEN_DATA_DIR {
                let _ = open_data_dir(app);
                return;
            }
            if event.id().as_ref() == MENU_ID_OPEN_LOG_PANEL {
                let _ = commands::log_commands::open_log_panel_window(app.clone());
            }
        })
        .setup(|app| {
            logger::init(&app.handle())
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            let app_state = state::build_app_state(&app.handle()).map_err(|err| {
                let io_err = std::io::Error::new(std::io::ErrorKind::Other, err.to_string());
                Box::new(io_err) as Box<dyn std::error::Error>
            })?;
            start_proxy_daemon_sidecar(&app.handle(), &app_state)
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            app.manage(app_state);
            setup_native_menu(app)?;
            start_runtime_guard(app.handle().clone());
            logger::info("app", "tauri setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::group_commands::create_profile_group,
            commands::group_commands::list_profile_groups,
            commands::group_commands::update_profile_group,
            commands::group_commands::delete_profile_group,
            commands::group_commands::restore_profile_group,
            commands::group_commands::purge_profile_group,
            commands::profile_commands::create_profile,
            commands::profile_commands::list_profiles,
            commands::profile_commands::open_profile,
            commands::profile_commands::close_profile,
            commands::profile_commands::delete_profile,
            commands::profile_commands::restore_profile,
            commands::profile_commands::purge_profile,
            commands::profile_commands::update_profile,
            commands::profile_commands::update_profile_visual,
            commands::profile_commands::get_profile_runtime_details,
            commands::profile_commands::clear_profile_cache,
            commands::profile_commands::read_profile_cookies,
            commands::profile_commands::export_profile_cookies,
            commands::profile_commands::set_profile_group,
            commands::profile_commands::batch_set_profile_group,
            commands::profile_commands::list_profile_font_families,
            commands::profile_commands::list_profile_device_presets,
            commands::profile_commands::list_fingerprint_presets,
            commands::profile_commands::preview_fingerprint_bundle,
            commands::profile_commands::create_profile_device_preset,
            commands::profile_commands::update_profile_device_preset,
            commands::profile_commands::batch_open_profiles,
            commands::profile_commands::batch_close_profiles,
            commands::profile_commands::get_local_api_server_status,
            commands::proxy_commands::create_proxy,
            commands::proxy_commands::update_proxy,
            commands::proxy_commands::list_proxies,
            commands::proxy_commands::delete_proxy,
            commands::proxy_commands::batch_update_proxies,
            commands::proxy_commands::batch_delete_proxies,
            commands::proxy_commands::import_proxies,
            commands::proxy_commands::check_proxy,
            commands::proxy_commands::batch_check_proxies,
            commands::proxy_commands::restore_proxy,
            commands::proxy_commands::purge_proxy,
            commands::proxy_commands::bind_profile_proxy,
            commands::proxy_commands::unbind_profile_proxy,
            commands::proxy_commands::get_profile_proxy,
            commands::resource_commands::list_resources,
            commands::resource_commands::download_resource,
            commands::resource_commands::install_chromium_resource,
            commands::resource_commands::activate_chromium_version,
            commands::log_commands::read_backend_logs,
            commands::log_commands::open_log_panel_window,
            commands::log_commands::export_backend_logs,
            commands::plugin_commands::list_plugin_packages,
            commands::plugin_commands::download_plugin_by_extension_id,
            commands::plugin_commands::check_plugin_update,
            commands::plugin_commands::update_plugin_package,
            commands::plugin_commands::uninstall_plugin_package,
            commands::plugin_commands::install_plugin_to_profiles,
            commands::plugin_commands::read_profile_plugins,
            commands::plugin_commands::update_profile_plugins,
            commands::sync_commands::ensure_sync_sidecar_started,
            commands::sync_commands::list_sync_targets,
            commands::sync_commands::broadcast_sync_text,
            commands::sync_commands::list_display_monitors,
            commands::sync_commands::arrange_profile_windows,
            commands::sync_commands::batch_restore_profile_windows,
            commands::sync_commands::batch_set_profile_window_bounds,
            commands::window_commands::list_open_profile_windows,
            commands::window_commands::open_profile_tab,
            commands::window_commands::close_profile_tab,
            commands::window_commands::close_inactive_tabs,
            commands::window_commands::open_profile_window,
            commands::window_commands::close_profile_window,
            commands::window_commands::focus_profile_window,
            commands::window_commands::set_profile_window_bounds,
            commands::window_commands::activate_tab,
            commands::window_commands::activate_tab_by_index,
            commands::window_commands::batch_open_profile_tabs,
            commands::window_commands::batch_close_profile_tabs,
            commands::window_commands::batch_close_inactive_tabs,
            commands::window_commands::batch_open_profile_windows,
            commands::window_commands::batch_focus_profile_windows,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_native_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let tools_submenu = SubmenuBuilder::new(app, "Tools")
        .item(&MenuItemBuilder::with_id(MENU_ID_OPEN_LOG_PANEL, "打开日志面板").build(app)?)
        .item(&MenuItemBuilder::with_id(MENU_ID_OPEN_DATA_DIR, "打开数据目录").build(app)?)
        .build()?;
    let menu = MenuBuilder::new(app)
        .item(&edit_submenu)
        .item(&tools_submenu)
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

fn start_runtime_guard(app: AppHandle) {
    let _ = thread::Builder::new()
        .name("multi-flow-runtime-guard".to_string())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(3));
            let state = app.state::<state::AppState>();
            if let Err(err) = runtime_guard::reconcile_runtime_state(&state) {
                logger::warn("runtime_guard", format!("reconcile failed: {err}"));
            }
        });
}

fn start_proxy_daemon_sidecar(app: &AppHandle, app_state: &state::AppState) -> Result<(), String> {
    let (bind_address, bind_port) = {
        let local_api_server = app_state
            .local_api_server
            .lock()
            .map_err(|_| "local api server lock poisoned".to_string())?;
        (
            local_api_server.bind_address().to_string(),
            local_api_server.bind_port()?,
        )
    };

    {
        let mut local_api_server = app_state
            .local_api_server
            .lock()
            .map_err(|_| "local api server lock poisoned".to_string())?;
        if local_api_server.check_daemon_health() {
            local_api_server.mark_started();
            logger::info(
                "proxy_daemon",
                format!("proxy daemon already reachable at {bind_address}, skip sidecar spawn"),
            );
            return Ok(());
        }
    }

    let bind_port_text = bind_port.to_string();
    let daemon_log_level = std::env::var(PROXY_DAEMON_RUST_LOG_ENV)
        .ok()
        .and_then(trim_to_option)
        .unwrap_or_else(|| DEFAULT_PROXY_DAEMON_RUST_LOG.to_string());
    let sidecar_command = app
        .shell()
        .sidecar(PROXY_DAEMON_SIDECAR_NAME)
        .map_err(|err| format!("resolve proxy daemon sidecar failed: {err}"))?;
    let (mut events, child) = sidecar_command
        .env("RUST_LOG", daemon_log_level.as_str())
        .args(["--port", bind_port_text.as_str()])
        .spawn()
        .map_err(|err| format!("spawn proxy daemon sidecar failed: {err}"))?;
    let daemon_pid = child.pid();
    logger::info(
        "proxy_daemon",
        format!(
            "proxy daemon sidecar spawn requested pid={daemon_pid} port={} rust_log={}",
            bind_port, daemon_log_level
        ),
    );
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if let Some(line) = sidecar_line(bytes.as_slice()) {
                        logger::info("proxy_daemon.stdout", line);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    if let Some(line) = sidecar_line(bytes.as_slice()) {
                        logger::warn("proxy_daemon.stderr", line);
                    }
                }
                CommandEvent::Error(err) => {
                    logger::error("proxy_daemon", format!("sidecar event stream error: {err}"));
                }
                CommandEvent::Terminated(payload) => {
                    logger::warn(
                        "proxy_daemon",
                        format!(
                            "proxy daemon terminated code={:?} signal={:?}",
                            payload.code, payload.signal
                        ),
                    );
                }
                _ => {}
            }
        }
        logger::warn("proxy_daemon", "proxy daemon sidecar event stream closed");
    });

    for _ in 0..20 {
        thread::sleep(Duration::from_millis(120));
        let mut local_api_server = app_state
            .local_api_server
            .lock()
            .map_err(|_| "local api server lock poisoned".to_string())?;
        if local_api_server.check_daemon_health() {
            local_api_server.mark_started();
            logger::info(
                "proxy_daemon",
                format!("proxy daemon sidecar started at {bind_address}"),
            );
            return Ok(());
        }
    }

    Err(format!(
        "proxy daemon sidecar spawned but health check timed out at {bind_address}"
    ))
}

fn open_data_dir(app: &AppHandle) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| format!("resolve data dir failed: {err}"))?;
    fs::create_dir_all(&data_dir).map_err(|err| format!("create data dir failed: {err}"))?;

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command.arg(&data_dir);
    command
        .spawn()
        .map_err(|err| format!("open data dir failed: {err}"))?;
    logger::info(
        "menu",
        format!("open data dir requested: {}", data_dir.to_string_lossy()),
    );
    Ok(())
}

fn sidecar_line(bytes: &[u8]) -> Option<String> {
    let line = String::from_utf8_lossy(bytes).trim().to_string();
    if line.is_empty() {
        None
    } else {
        Some(line)
    }
}

fn trim_to_option(input: String) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
