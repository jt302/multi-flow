use std::collections::HashMap;
use std::fs;
use std::panic;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Once;
use std::thread;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::plugin::Builder as TauriPluginBuilder;
use tauri::utils::config::WindowConfig;
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::services::app_preference_service::normalize_app_language;
use crate::state::resolve_app_data_dir;

const MENU_ID_OPEN_DATA_DIR: &str = "open_data_dir";
const MENU_ID_OPEN_DEVTOOLS: &str = "open_devtools";
const MENU_ID_OPEN_LOG_PANEL: &str = "open_log_panel";
const MENU_ID_RELOAD_MAIN_WINDOW: &str = "reload_main_window";
const MAIN_WINDOW_LABEL: &str = "main";
const MAIN_WINDOW_STATE_FILENAME: &str = "main-window-state.json";
const PLUGIN_WINDOW_STATE_FILENAME: &str = ".window-state.json";
const PROXY_DAEMON_SIDECAR_NAME: &str = "proxy-daemon";
const PROXY_DAEMON_RUST_LOG_ENV: &str = "MULTI_FLOW_PROXY_DAEMON_RUST_LOG";
const DEFAULT_PROXY_DAEMON_RUST_LOG: &str = "info";
static PANIC_HOOK_ONCE: Once = Once::new();
/// init 完成且 400ms 动画延迟已过，React 可安全触发窗口切换
static INIT_COMPLETE: AtomicBool = AtomicBool::new(false);
/// 闪屏 JS listener 已注册完毕，run_app_init 可以开始 emit 进度事件
static SPLASH_READY: AtomicBool = AtomicBool::new(false);
/// 主窗口已经执行过“关 splash + 显窗口”，避免前端 ready 与后端 fallback 重复触发
static MAIN_WINDOW_SHOWN: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct NativeMenuTranslations {
    edit_menu: &'static str,
    window_menu: &'static str,
    tools_menu: &'static str,
    open_devtools: &'static str,
    reload: &'static str,
    open_log_panel: &'static str,
    open_data_dir: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CloseConfirmDialogText {
    title: &'static str,
    message: String,
    confirm_label: &'static str,
    cancel_label: &'static str,
}

mod commands;
mod db;
mod engine_manager;
mod error;
mod fingerprint_catalog;
mod font_catalog;
mod local_api_server;
mod logger;
mod models;
mod runtime_compat;
mod runtime_guard;
mod services;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 自定义 tokio runtime：增大线程栈至 8MB
    // 防止 AI Agent 工具调用时 execute_step 的大型 Future 嵌套导致栈溢出
    // （默认约 2MB，嵌套的 execute_step Future 可超出此限制）
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(8 * 1024 * 1024)
        .build()
        .expect("Failed to create tokio runtime");
    tauri::async_runtime::set(runtime.handle().clone());
    // 泄漏 runtime 以保持其在整个应用生命周期内存活
    // （tauri::async_runtime::set 只接受 Handle，不持有 Runtime 所有权）
    Box::leak(Box::new(runtime));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .skip_initial_state(MAIN_WINDOW_LABEL)
                .build(),
        )
        .plugin(
            TauriPluginBuilder::<tauri::Wry, ()>::new("main-window-state")
                .on_event(|app, event| {
                    if let RunEvent::Exit = event {
                        save_main_window_state_if_needed(app, "app_exit", true);
                    }
                })
                .build(),
        )
        .on_menu_event(|app, event| {
            if event.id().as_ref() == MENU_ID_OPEN_DEVTOOLS {
                open_main_window_devtools(app);
                return;
            }
            if event.id().as_ref() == MENU_ID_RELOAD_MAIN_WINDOW {
                reload_main_window(app);
                return;
            }
            if event.id().as_ref() == MENU_ID_OPEN_DATA_DIR {
                let _ = open_data_dir(app);
                return;
            }
            if event.id().as_ref() == MENU_ID_OPEN_LOG_PANEL {
                let _ = commands::log_commands::open_log_panel_window(app.clone());
            }
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }

            match event {
                WindowEvent::Moved(_) => save_main_window_state(window, "moved", false),
                WindowEvent::Resized(_) => save_main_window_state(window, "resized", false),
                WindowEvent::CloseRequested { api, .. } => {
                    let state: tauri::State<'_, state::AppState> = window.state();
                    let engine_count = state.lock_engine_manager().active_session_count();
                    let run_count = state.cancel_tokens.lock().unwrap().len();

                    if engine_count > 0 || run_count > 0 {
                        api.prevent_close();
                        let window_clone = window.clone();
                        let dialog = build_close_confirm_dialog_text(
                            current_app_language(&window.app_handle()),
                            engine_count,
                            run_count,
                        );
                        window
                            .dialog()
                            .message(dialog.message)
                            .title(dialog.title)
                            .buttons(MessageDialogButtons::OkCancelCustom(
                                dialog.confirm_label.to_string(),
                                dialog.cancel_label.to_string(),
                            ))
                            .show(move |confirmed| {
                                if confirmed {
                                    save_main_window_state(&window_clone, "close_confirmed", true);
                                    window_clone.destroy().ok();
                                }
                            });
                    } else {
                        save_main_window_state(window, "close_requested", true);
                    }
                }
                WindowEvent::Destroyed => save_main_window_state(window, "destroyed", true),
                _ => {}
            }
        })
        .setup(|app| {
            logger::init(&app.handle())
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            install_panic_hook();

            // 通过 builder 创建闪屏窗口，确保 transparent/decorations 正确应用到原生 WKWebView
            // （config 方式有时无法正确设置 WKWebView.isOpaque = false，导致圆角处有白边）
            let splash_url = tauri::WebviewUrl::App("splashscreen.html".into());
            WebviewWindowBuilder::new(app, "splashscreen", splash_url)
                .title("Multi Flow")
                .inner_size(400.0, 280.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .center()
                .visible(true)
                .build()
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;

            // 将重型初始化移到后台线程，让 setup() 立即返回，
            // 保证主线程事件循环能正常运转并渲染闪屏窗口
            let handle = app.handle().clone();
            thread::Builder::new()
                .name("multi-flow-init".to_string())
                .spawn(move || {
                    if let Err(err) = run_app_init(handle) {
                        eprintln!("app init failed: {err}");
                        std::process::exit(1);
                    }
                })
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat_commands::list_chat_sessions,
            commands::chat_commands::create_chat_session,
            commands::chat_commands::update_chat_session,
            commands::chat_commands::delete_chat_session,
            commands::chat_commands::list_chat_messages,
            commands::chat_commands::send_chat_message,
            commands::chat_commands::stop_chat_generation,
            commands::chat_commands::regenerate_chat_message,
            commands::chat_commands::read_ai_chat_global_prompt,
            commands::chat_commands::update_ai_chat_global_prompt,
            commands::chat_commands::read_global_default_startup_url,
            commands::chat_commands::update_global_default_startup_url,
            commands::chat_commands::get_profile_environment_context,
            commands::chat_commands::test_ai_connection,
            commands::chat_commands::get_tool_permissions,
            commands::chat_commands::set_tool_permission,
            commands::chat_commands::set_all_tool_permissions,
            commands::chat_commands::submit_tool_confirmation,
            commands::ai_skill_commands::list_ai_skills,
            commands::ai_skill_commands::read_ai_skill,
            commands::ai_skill_commands::create_ai_skill,
            commands::ai_skill_commands::update_ai_skill,
            commands::ai_skill_commands::delete_ai_skill,
            commands::ai_skill_commands::install_ai_skill,
            commands::automation_canvas_commands::open_automation_canvas_window,
            commands::automation_commands::list_automation_scripts,
            commands::automation_commands::create_automation_script,
            commands::automation_commands::update_automation_script,
            commands::automation_commands::save_automation_canvas_graph,
            commands::automation_commands::delete_automation_script,
            commands::automation_commands::list_automation_runs,
            commands::automation_commands::delete_automation_run,
            commands::automation_commands::clear_automation_runs,
            commands::automation_commands::run_automation_script,
            commands::automation_commands::resume_automation_run,
            commands::automation_commands::cancel_automation_run,
            commands::automation_commands::read_ai_provider_config,
            commands::automation_commands::update_ai_provider_config,
            commands::automation_commands::list_ai_configs,
            commands::automation_commands::create_ai_config,
            commands::automation_commands::update_ai_config,
            commands::automation_commands::delete_ai_config,
            commands::automation_commands::get_default_ai_config_id,
            commands::automation_commands::set_default_ai_config_id,
            commands::automation_commands::list_captcha_configs,
            commands::automation_commands::create_captcha_config,
            commands::automation_commands::update_captcha_config,
            commands::automation_commands::delete_captcha_config,
            commands::automation_commands::read_dev_chromium_executable,
            commands::automation_commands::save_dev_chromium_executable,
            commands::automation_commands::read_chromium_logging_enabled,
            commands::automation_commands::update_chromium_logging_enabled,
            commands::automation_commands::read_app_language,
            commands::automation_commands::update_app_language,
            commands::automation_commands::update_script_canvas_positions,
            commands::automation_commands::update_script_variables_schema,
            commands::automation_commands::list_active_automation_runs,
            commands::automation_commands::submit_ai_dialog_response,
            commands::automation_commands::run_automation_script_debug,
            commands::automation_commands::export_automation_script_to_file,
            commands::group_commands::create_profile_group,
            commands::group_commands::list_profile_groups,
            commands::group_commands::update_profile_group,
            commands::group_commands::delete_profile_group,
            commands::group_commands::restore_profile_group,
            commands::group_commands::purge_profile_group,
            commands::profile_commands::create_profile,
            commands::profile_commands::duplicate_profile,
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
            commands::profile_commands::delete_profile_device_preset,
            commands::profile_commands::batch_open_profiles,
            commands::profile_commands::batch_close_profiles,
            commands::profile_commands::get_local_api_server_status,
            commands::profile_commands::host_locale_suggestion,
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
            commands::resource_commands::get_active_resource_downloads,
            commands::resource_commands::download_resource,
            commands::resource_commands::install_chromium_resource,
            commands::resource_commands::activate_chromium_version,
            commands::log_commands::read_backend_logs,
            commands::log_commands::open_log_panel_window,
            commands::log_commands::export_backend_logs,
            commands::plugin_commands::list_plugin_packages,
            commands::plugin_commands::read_plugin_download_preference,
            commands::plugin_commands::update_plugin_download_preference,
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
            commands::sync_commands::restore_last_arrangement,
            commands::sync_commands::batch_restore_profile_windows,
            commands::sync_commands::batch_set_profile_window_bounds,
            commands::window_commands::splashscreen_ready,
            commands::window_commands::show_main_window,
            commands::window_commands::is_init_complete,
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
            commands::fs_workspace_commands::fs_list_roots,
            commands::fs_workspace_commands::fs_list_dir,
            commands::fs_workspace_commands::fs_create_folder,
            commands::fs_workspace_commands::fs_delete_entry,
            commands::fs_workspace_commands::fs_read_description,
            commands::fs_workspace_commands::fs_save_description,
            commands::fs_workspace_commands::fs_set_sandbox_root,
            commands::fs_workspace_commands::fs_get_sandbox_root,
            commands::fs_workspace_commands::fs_get_whitelist,
            commands::fs_workspace_commands::fs_add_whitelist_entry,
            commands::fs_workspace_commands::fs_remove_whitelist_entry,
            commands::fs_workspace_commands::fs_update_whitelist_entry,
            commands::mcp_commands::list_mcp_servers,
            commands::mcp_commands::get_mcp_server,
            commands::mcp_commands::create_mcp_server,
            commands::mcp_commands::update_mcp_server,
            commands::mcp_commands::delete_mcp_server,
            commands::mcp_commands::enable_mcp_server,
            commands::mcp_commands::disable_mcp_server,
            commands::mcp_commands::test_mcp_connection,
            commands::mcp_commands::test_mcp_connection_draft,
            commands::mcp_commands::start_mcp_oauth,
            commands::mcp_commands::list_mcp_tools,
            commands::mcp_commands::list_all_mcp_tools,
            commands::mcp_commands::call_mcp_tool,
            commands::mcp_commands::discover_mcp_oauth,
        ])
        .plugin(
            TauriPluginBuilder::<tauri::Wry, ()>::new("mcp-lifecycle")
                .on_event(|app, event| {
                    if let RunEvent::Exit = event {
                        let mcp_manager = app.state::<crate::state::AppState>().mcp_manager.clone();
                        if let Ok(rt) = tokio::runtime::Handle::try_current() {
                            rt.block_on(async { mcp_manager.shutdown_all().await });
                        }
                    }
                })
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn install_panic_hook() {
    PANIC_HOOK_ONCE.call_once(|| {
        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |panic_info| {
            let location = panic_info
                .location()
                .map(|location| format!("{}:{}", location.file(), location.line()))
                .unwrap_or_else(|| "unknown".to_string());
            let payload = if let Some(message) = panic_info.payload().downcast_ref::<&str>() {
                (*message).to_string()
            } else if let Some(message) = panic_info.payload().downcast_ref::<String>() {
                message.clone()
            } else {
                "non-string panic payload".to_string()
            };
            let backtrace = std::backtrace::Backtrace::force_capture();
            logger::error(
                "panic",
                format!("panic at {location}: {payload}\nbacktrace:\n{backtrace}"),
            );
            default_hook(panic_info);
        }));
    });
}

fn read_saved_app_language(app: &AppHandle) -> Option<String> {
    app.state::<state::AppState>()
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .read_app_language()
        .ok()
        .flatten()
}

pub(crate) fn resolve_effective_app_language(
    saved_locale: Option<&str>,
    system_locale: Option<&str>,
) -> &'static str {
    saved_locale
        .filter(|value| !value.trim().is_empty())
        .map(normalize_app_language)
        .or_else(|| {
            system_locale
                .filter(|value| !value.trim().is_empty())
                .map(normalize_app_language)
        })
        .unwrap_or("zh-CN")
}

fn current_app_language(app: &AppHandle) -> &'static str {
    resolve_effective_app_language(
        read_saved_app_language(app).as_deref(),
        sys_locale::get_locale().as_deref(),
    )
}

fn native_menu_translations_for_locale(locale: &str) -> NativeMenuTranslations {
    if normalize_app_language(locale) == "en-US" {
        NativeMenuTranslations {
            edit_menu: "Edit",
            window_menu: "Window",
            tools_menu: "Tools",
            open_devtools: "Open Developer Tools",
            reload: "Reload",
            open_log_panel: "Log Panel",
            open_data_dir: "Open Data Directory",
        }
    } else {
        NativeMenuTranslations {
            edit_menu: "编辑",
            window_menu: "窗口",
            tools_menu: "工具",
            open_devtools: "打开开发者调试工具",
            reload: "刷新",
            open_log_panel: "日志面板",
            open_data_dir: "打开数据目录",
        }
    }
}

fn build_close_confirm_dialog_text(
    locale: &str,
    engine_count: usize,
    run_count: usize,
) -> CloseConfirmDialogText {
    if normalize_app_language(locale) == "en-US" {
        let mut message = String::from("The following activities are still running:\n");
        if engine_count > 0 {
            message.push_str(&format!(
                "• {engine_count} browser environment(s) are still running\n"
            ));
        }
        if run_count > 0 {
            message.push_str(&format!(
                "• {run_count} automation task(s) are still running\n"
            ));
        }
        message.push_str("\nClosing the window will terminate all related processes. Exit now?");
        CloseConfirmDialogText {
            title: "Confirm Exit",
            message,
            confirm_label: "Exit",
            cancel_label: "Cancel",
        }
    } else {
        let mut message = String::from("当前有以下活动：\n");
        if engine_count > 0 {
            message.push_str(&format!("• {engine_count} 个浏览器环境正在运行\n"));
        }
        if run_count > 0 {
            message.push_str(&format!("• {run_count} 个自动化任务正在执行\n"));
        }
        message.push_str("\n关闭窗口将终止所有进程，确定要退出吗？");
        CloseConfirmDialogText {
            title: "确认退出",
            message,
            confirm_label: "退出",
            cancel_label: "取消",
        }
    }
}

pub(crate) fn setup_native_menu(
    app: &AppHandle,
    locale_override: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let locale = locale_override
        .map(normalize_app_language)
        .unwrap_or_else(|| current_app_language(app));
    let translations = native_menu_translations_for_locale(locale);

    let edit_submenu = SubmenuBuilder::new(app, translations.edit_menu)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window_submenu = SubmenuBuilder::new(app, translations.window_menu)
        .close_window()
        .minimize()
        .build()?;
    let tools_submenu = SubmenuBuilder::new(app, translations.tools_menu)
        .item(
            &MenuItemBuilder::with_id(MENU_ID_OPEN_DEVTOOLS, translations.open_devtools)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_ID_RELOAD_MAIN_WINDOW, translations.reload)
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(MENU_ID_OPEN_LOG_PANEL, translations.open_log_panel)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_ID_OPEN_DATA_DIR, translations.open_data_dir)
                .build(app)?,
        )
        .build()?;
    let menu = MenuBuilder::new(app)
        .item(&edit_submenu)
        .item(&window_submenu)
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
    let data_dir = resolve_app_data_dir(app).map_err(|err| err.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|err| format!("create data dir failed: {err}"))?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        // -R reveals the item in Finder instead of trying to launch it.
        // Without -R, macOS treats paths ending in ".app" as app bundles.
        cmd.arg("-R");
        cmd
    };
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

fn open_main_window_devtools(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        logger::warn(
            "menu",
            format!("open devtools requested but window={MAIN_WINDOW_LABEL} not found"),
        );
        return;
    };

    logger::info(
        "menu",
        format!("open devtools requested for window={MAIN_WINDOW_LABEL}"),
    );
    window.open_devtools();
}

fn reload_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        logger::warn(
            "menu",
            format!("reload requested but window={MAIN_WINDOW_LABEL} not found"),
        );
        return;
    };

    logger::info(
        "menu",
        format!("reload requested for window={MAIN_WINDOW_LABEL}"),
    );
    if let Err(err) = window.reload() {
        logger::warn(
            "menu",
            format!("reload failed for window={MAIN_WINDOW_LABEL}: {err}"),
        );
    }
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

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq)]
struct SavedMainWindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    maximized: bool,
    fullscreen: bool,
    #[serde(default)]
    monitor: Option<SavedMonitorSnapshot>,
}

impl Default for SavedMainWindowState {
    fn default() -> Self {
        Self {
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            maximized: false,
            fullscreen: false,
            monitor: None,
        }
    }
}

#[derive(Clone, Copy, Debug, serde::Serialize, serde::Deserialize, PartialEq)]
struct SavedMonitorSnapshot {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    scale_factor: f64,
}

#[derive(Clone, Debug, serde::Deserialize)]
struct SavedPluginWindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    prev_x: i32,
    prev_y: i32,
    maximized: bool,
    fullscreen: bool,
}

#[derive(Clone, Debug)]
struct LoadedMainWindowState {
    state: SavedMainWindowState,
    source: &'static str,
}

trait MainWindowStateSource {
    fn app_handle_owned(&self) -> AppHandle;
    fn is_maximized_state(&self) -> Result<bool, String>;
    fn is_minimized_state(&self) -> Result<bool, String>;
    fn is_fullscreen_state(&self) -> Result<bool, String>;
    fn inner_size_state(&self) -> Result<(u32, u32), String>;
    fn outer_position_state(&self) -> Result<(i32, i32), String>;
    fn current_monitor_snapshot(&self) -> Option<SavedMonitorSnapshot>;
    fn available_monitor_snapshots(&self) -> Vec<SavedMonitorSnapshot>;
}

impl MainWindowStateSource for Window {
    fn app_handle_owned(&self) -> AppHandle {
        self.app_handle().clone()
    }

    fn is_maximized_state(&self) -> Result<bool, String> {
        self.is_maximized()
            .map_err(|err| format!("read maximized state failed: {err}"))
    }

    fn is_minimized_state(&self) -> Result<bool, String> {
        self.is_minimized()
            .map_err(|err| format!("read minimized state failed: {err}"))
    }

    fn is_fullscreen_state(&self) -> Result<bool, String> {
        self.is_fullscreen()
            .map_err(|err| format!("read fullscreen state failed: {err}"))
    }

    fn inner_size_state(&self) -> Result<(u32, u32), String> {
        self.inner_size()
            .map(|size| (size.width, size.height))
            .map_err(|err| format!("read inner size failed: {err}"))
    }

    fn outer_position_state(&self) -> Result<(i32, i32), String> {
        self.outer_position()
            .map(|position| (position.x, position.y))
            .map_err(|err| format!("read outer position failed: {err}"))
    }

    fn current_monitor_snapshot(&self) -> Option<SavedMonitorSnapshot> {
        self.current_monitor()
            .ok()
            .flatten()
            .map(saved_monitor_snapshot)
    }

    fn available_monitor_snapshots(&self) -> Vec<SavedMonitorSnapshot> {
        self.available_monitors()
            .unwrap_or_default()
            .into_iter()
            .map(saved_monitor_snapshot)
            .collect()
    }
}

impl MainWindowStateSource for WebviewWindow {
    fn app_handle_owned(&self) -> AppHandle {
        self.app_handle().clone()
    }

    fn is_maximized_state(&self) -> Result<bool, String> {
        self.is_maximized()
            .map_err(|err| format!("read maximized state failed: {err}"))
    }

    fn is_minimized_state(&self) -> Result<bool, String> {
        self.is_minimized()
            .map_err(|err| format!("read minimized state failed: {err}"))
    }

    fn is_fullscreen_state(&self) -> Result<bool, String> {
        self.is_fullscreen()
            .map_err(|err| format!("read fullscreen state failed: {err}"))
    }

    fn inner_size_state(&self) -> Result<(u32, u32), String> {
        self.inner_size()
            .map(|size| (size.width, size.height))
            .map_err(|err| format!("read inner size failed: {err}"))
    }

    fn outer_position_state(&self) -> Result<(i32, i32), String> {
        self.outer_position()
            .map(|position| (position.x, position.y))
            .map_err(|err| format!("read outer position failed: {err}"))
    }

    fn current_monitor_snapshot(&self) -> Option<SavedMonitorSnapshot> {
        self.current_monitor()
            .ok()
            .flatten()
            .map(saved_monitor_snapshot)
    }

    fn available_monitor_snapshots(&self) -> Vec<SavedMonitorSnapshot> {
        self.available_monitors()
            .unwrap_or_default()
            .into_iter()
            .map(saved_monitor_snapshot)
            .collect()
    }
}

/// 创建主窗口但保持隐藏（visible: false），由前端 React 渲染完成后调用 show_main_window 命令显示
fn build_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    let base_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW_LABEL)
        .cloned()
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "main window config not found in tauri.conf.json",
            )
        })?;
    let window_config = apply_saved_main_window_state(app, base_config);
    WebviewWindowBuilder::from_config(app, &window_config)?.build()?;
    Ok(())
}

fn apply_saved_main_window_state(app: &AppHandle, mut config: WindowConfig) -> WindowConfig {
    config.visible = false;

    let Some(loaded) = load_saved_main_window_state(app) else {
        logger::info("main_window", "no saved state found, using default config");
        return config;
    };

    let restored = apply_saved_main_window_state_with_monitors(
        config,
        &loaded.state,
        &collect_saved_monitor_snapshots(app),
    );

    logger::info(
        "main_window",
        format!(
            "restored state from {} x={:?} y={:?} width={} height={} maximized={} fullscreen={}",
            loaded.source,
            restored.x,
            restored.y,
            restored.width,
            restored.height,
            restored.maximized,
            restored.fullscreen
        ),
    );

    restored
}

fn apply_saved_main_window_state_with_monitors(
    mut config: WindowConfig,
    state: &SavedMainWindowState,
    monitors: &[SavedMonitorSnapshot],
) -> WindowConfig {
    config.visible = false;

    let Some(monitor) = find_restore_monitor_for_main_window(monitors, state) else {
        return config;
    };

    let (x, y, width, height) = clamp_saved_main_window_bounds(state, monitor);
    config.center = false;
    config.x = Some(physical_to_logical(x as f64, monitor.scale_factor));
    config.y = Some(physical_to_logical(y as f64, monitor.scale_factor));
    config.width = physical_to_logical(width as f64, monitor.scale_factor);
    config.height = physical_to_logical(height as f64, monitor.scale_factor);
    config.maximized = state.maximized;
    config.fullscreen = state.fullscreen;
    config
}

pub(crate) fn show_main_window_if_needed(app: &AppHandle, source: &str) {
    if MAIN_WINDOW_SHOWN.swap(true, Ordering::AcqRel) {
        return;
    }

    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();

        // 延迟再 set_focus 一次，避免 macOS window-activation click 吞掉 webview 首次 mousedown
        let window_clone = window.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(120)).await;
            let _ = window_clone.set_focus();
        });
    }

    logger::info("main_window", format!("show main window via {source}"));
}

fn save_main_window_state<T: MainWindowStateSource>(window: &T, reason: &str, log_success: bool) {
    match capture_main_window_state(window).and_then(|state| {
        let path = main_window_state_path(&window.app_handle_owned())?;
        save_main_window_state_to_path(&path, &state)?;
        Ok((path, state))
    }) {
        Ok((path, state)) => {
            if log_success {
                logger::info(
                    "main_window",
                    format!(
                        "saved state via {reason} at {} x={} y={} width={} height={} maximized={} fullscreen={}",
                        path.to_string_lossy(),
                        state.x,
                        state.y,
                        state.width,
                        state.height,
                        state.maximized,
                        state.fullscreen
                    ),
                );
            }
        }
        Err(err) => {
            logger::warn(
                "main_window",
                format!("save state via {reason} failed: {err}"),
            );
        }
    }
}

fn save_main_window_state_if_needed(app: &AppHandle, reason: &str, log_success: bool) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        save_main_window_state(&window, reason, log_success);
    }
}

fn capture_main_window_state<T: MainWindowStateSource>(
    window: &T,
) -> Result<SavedMainWindowState, String> {
    let loaded = load_saved_main_window_state(&window.app_handle_owned());
    let mut state = loaded
        .as_ref()
        .map(|loaded| loaded.state.clone())
        .unwrap_or_default();
    let had_saved_geometry = loaded.is_some();

    let is_maximized = window.is_maximized_state()?;
    let is_minimized = window.is_minimized_state()?;
    state.maximized = is_maximized;
    state.fullscreen = window.is_fullscreen_state()?;

    if !is_minimized && (!is_maximized || !had_saved_geometry) {
        let (width, height) = window.inner_size_state()?;
        let (x, y) = window.outer_position_state()?;

        if width > 0 && height > 0 {
            state.width = width;
            state.height = height;
            state.x = x;
            state.y = y;
            state.monitor = capture_monitor_snapshot_for_window(window, x, y, width, height);
        }
    }

    Ok(state)
}

fn load_saved_main_window_state(app: &AppHandle) -> Option<LoadedMainWindowState> {
    let dedicated_path = main_window_state_path(app).ok()?;
    if let Some(state) = load_saved_main_window_state_from_path(&dedicated_path) {
        return Some(LoadedMainWindowState {
            state,
            source: MAIN_WINDOW_STATE_FILENAME,
        });
    }

    load_saved_main_window_plugin_state(app).map(|state| LoadedMainWindowState {
        state,
        source: PLUGIN_WINDOW_STATE_FILENAME,
    })
}

fn load_saved_main_window_state_from_path(path: &Path) -> Option<SavedMainWindowState> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_main_window_state_to_path(path: &Path, state: &SavedMainWindowState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("create main window state dir failed: {err}"))?;
    }
    let content = serde_json::to_vec_pretty(state)
        .map_err(|err| format!("serialize main window state failed: {err}"))?;
    fs::write(path, content).map_err(|err| format!("write main window state failed: {err}"))?;
    Ok(())
}

fn load_saved_main_window_plugin_state(app: &AppHandle) -> Option<SavedMainWindowState> {
    let state_file = app_config_dir(app).ok()?.join(PLUGIN_WINDOW_STATE_FILENAME);
    let content = fs::read_to_string(state_file).ok()?;
    let state_map: HashMap<String, SavedPluginWindowState> = serde_json::from_str(&content).ok()?;
    let state = state_map.get(MAIN_WINDOW_LABEL)?;
    Some(SavedMainWindowState {
        width: state.width,
        height: state.height,
        x: if state.maximized {
            state.prev_x
        } else {
            state.x
        },
        y: if state.maximized {
            state.prev_y
        } else {
            state.y
        },
        maximized: state.maximized,
        fullscreen: state.fullscreen,
        monitor: None,
    })
}

fn main_window_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(MAIN_WINDOW_STATE_FILENAME))
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .or_else(|_| app.path().app_local_data_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| format!("resolve app config dir failed: {err}"))
}

fn collect_saved_monitor_snapshots(app: &AppHandle) -> Vec<SavedMonitorSnapshot> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| SavedMonitorSnapshot {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width as i32,
            height: monitor.size().height as i32,
            scale_factor: monitor.scale_factor(),
        })
        .collect()
}

fn capture_monitor_snapshot_for_window<T: MainWindowStateSource>(
    window: &T,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Option<SavedMonitorSnapshot> {
    window.current_monitor_snapshot().or_else(|| {
        let monitors = window.available_monitor_snapshots();
        find_monitor_for_saved_main_window(&monitors, x, y, width, height)
    })
}

fn find_restore_monitor_for_main_window(
    monitors: &[SavedMonitorSnapshot],
    state: &SavedMainWindowState,
) -> Option<SavedMonitorSnapshot> {
    find_monitor_for_saved_main_window(monitors, state.x, state.y, state.width, state.height)
        .or_else(|| {
            state
                .monitor
                .and_then(|saved| find_matching_monitor_for_saved_snapshot(monitors, saved))
        })
        .or_else(|| monitors.first().copied())
}

fn find_matching_monitor_for_saved_snapshot(
    monitors: &[SavedMonitorSnapshot],
    saved: SavedMonitorSnapshot,
) -> Option<SavedMonitorSnapshot> {
    monitors.iter().copied().min_by(|left, right| {
        monitor_similarity_score(*left, saved).cmp(&monitor_similarity_score(*right, saved))
    })
}

fn monitor_similarity_score(monitor: SavedMonitorSnapshot, saved: SavedMonitorSnapshot) -> i64 {
    let position_delta = (monitor.x - saved.x).abs() as i64 + (monitor.y - saved.y).abs() as i64;
    let size_delta =
        (monitor.width - saved.width).abs() as i64 + (monitor.height - saved.height).abs() as i64;
    let scale_delta = ((monitor.scale_factor - saved.scale_factor).abs() * 1000.0) as i64;

    position_delta + (size_delta * 4) + scale_delta
}

fn clamp_saved_main_window_bounds(
    state: &SavedMainWindowState,
    monitor: SavedMonitorSnapshot,
) -> (i32, i32, u32, u32) {
    let width = state.width.min(monitor.width.max(1) as u32);
    let height = state.height.min(monitor.height.max(1) as u32);
    let max_x = monitor.x + monitor.width - width as i32;
    let max_y = monitor.y + monitor.height - height as i32;
    let x = state.x.clamp(monitor.x, max_x.max(monitor.x));
    let y = state.y.clamp(monitor.y, max_y.max(monitor.y));

    (x, y, width, height)
}

fn find_monitor_for_saved_main_window(
    monitors: &[SavedMonitorSnapshot],
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Option<SavedMonitorSnapshot> {
    monitors.iter().copied().find(|monitor| {
        let overlap_x = (x + width as i32).min(monitor.x + monitor.width) - x.max(monitor.x);
        let overlap_y = (y + height as i32).min(monitor.y + monitor.height) - y.max(monitor.y);

        overlap_x >= 50 && overlap_y >= 50
    })
}

fn saved_monitor_snapshot(monitor: tauri::Monitor) -> SavedMonitorSnapshot {
    SavedMonitorSnapshot {
        x: monitor.position().x,
        y: monitor.position().y,
        width: monitor.size().width as i32,
        height: monitor.size().height as i32,
        scale_factor: monitor.scale_factor(),
    }
}

fn physical_to_logical(value: f64, scale_factor: f64) -> f64 {
    if scale_factor.is_finite() && scale_factor > 0.0 {
        value / scale_factor
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_saved_main_window_state_with_monitors, build_close_confirm_dialog_text,
        load_saved_main_window_state_from_path, native_menu_translations_for_locale,
        resolve_effective_app_language, save_main_window_state_to_path, SavedMainWindowState,
        SavedMonitorSnapshot,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri::utils::config::WindowConfig;

    #[test]
    fn main_window_restore_converts_physical_pixels_to_logical_pixels() {
        let config = WindowConfig {
            width: 1300.0,
            height: 800.0,
            visible: false,
            ..WindowConfig::default()
        };
        let state = SavedMainWindowState {
            width: 2600,
            height: 1600,
            x: 1260,
            y: 328,
            maximized: false,
            fullscreen: false,
            monitor: None,
        };
        let monitors = [SavedMonitorSnapshot {
            x: 0,
            y: 0,
            width: 5120,
            height: 2880,
            scale_factor: 2.0,
        }];

        let restored = apply_saved_main_window_state_with_monitors(config, &state, &monitors);

        assert_eq!(restored.x, Some(630.0));
        assert_eq!(restored.y, Some(164.0));
        assert_eq!(restored.width, 1300.0);
        assert_eq!(restored.height, 800.0);
        assert!(!restored.center);
    }

    #[test]
    fn main_window_restore_falls_back_to_primary_monitor_when_saved_bounds_are_offscreen() {
        let config = WindowConfig {
            width: 1300.0,
            height: 800.0,
            visible: false,
            ..WindowConfig::default()
        };
        let state = SavedMainWindowState {
            width: 2600,
            height: 1600,
            x: -6000,
            y: 400,
            maximized: false,
            fullscreen: false,
            monitor: Some(SavedMonitorSnapshot {
                x: -6200,
                y: 0,
                width: 3456,
                height: 2234,
                scale_factor: 2.0,
            }),
        };
        let monitors = [SavedMonitorSnapshot {
            x: 0,
            y: 0,
            width: 3024,
            height: 1964,
            scale_factor: 2.0,
        }];

        let restored = apply_saved_main_window_state_with_monitors(config, &state, &monitors);

        assert_eq!(restored.x, Some(0.0));
        assert_eq!(restored.y, Some(182.0));
        assert_eq!(restored.width, 1300.0);
        assert_eq!(restored.height, 800.0);
        assert!(!restored.center);
    }

    #[test]
    fn main_window_state_round_trip_preserves_geometry() {
        let path = unique_temp_state_path();
        let state = SavedMainWindowState {
            width: 1888,
            height: 1220,
            x: 144,
            y: 88,
            maximized: true,
            fullscreen: false,
            monitor: Some(SavedMonitorSnapshot {
                x: 0,
                y: 0,
                width: 3024,
                height: 1964,
                scale_factor: 2.0,
            }),
        };

        save_main_window_state_to_path(&path, &state).expect("save state");
        let loaded = load_saved_main_window_state_from_path(&path).expect("load state");

        assert_eq!(loaded, state);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn native_menu_translations_follow_app_language() {
        let zh = native_menu_translations_for_locale("zh-CN");
        assert_eq!(zh.edit_menu, "编辑");
        assert_eq!(zh.window_menu, "窗口");
        assert_eq!(zh.tools_menu, "工具");
        assert_eq!(zh.open_devtools, "打开开发者调试工具");
        assert_eq!(zh.reload, "刷新");
        assert_eq!(zh.open_log_panel, "日志面板");
        assert_eq!(zh.open_data_dir, "打开数据目录");

        let en = native_menu_translations_for_locale("en-US");
        assert_eq!(en.edit_menu, "Edit");
        assert_eq!(en.window_menu, "Window");
        assert_eq!(en.tools_menu, "Tools");
        assert_eq!(en.open_devtools, "Open Developer Tools");
        assert_eq!(en.reload, "Reload");
        assert_eq!(en.open_log_panel, "Log Panel");
        assert_eq!(en.open_data_dir, "Open Data Directory");
    }

    #[test]
    fn close_confirm_dialog_text_follows_language_and_counts() {
        let zh = build_close_confirm_dialog_text("zh-CN", 2, 1);
        assert_eq!(zh.title, "确认退出");
        assert_eq!(zh.confirm_label, "退出");
        assert_eq!(zh.cancel_label, "取消");
        assert!(zh.message.contains("2 个浏览器环境正在运行"));
        assert!(zh.message.contains("1 个自动化任务正在执行"));

        let en = build_close_confirm_dialog_text("en-US", 3, 4);
        assert_eq!(en.title, "Confirm Exit");
        assert_eq!(en.confirm_label, "Exit");
        assert_eq!(en.cancel_label, "Cancel");
        assert!(en
            .message
            .contains("3 browser environment(s) are still running"));
        assert!(en
            .message
            .contains("4 automation task(s) are still running"));
    }

    #[test]
    fn effective_app_language_prefers_saved_then_system_then_default() {
        assert_eq!(
            resolve_effective_app_language(Some("en-GB"), Some("zh-CN")),
            "en-US"
        );
        assert_eq!(resolve_effective_app_language(None, Some("en-GB")), "en-US");
        assert_eq!(resolve_effective_app_language(None, Some("fr-FR")), "zh-CN");
    }

    fn unique_temp_state_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("multi-flow-main-window-state-{nanos}.json"))
    }
}

/// 在后台线程中执行应用初始化，避免阻塞主线程事件循环
/// 主线程需要保持运转才能渲染闪屏窗口
fn run_app_init(handle: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let emit_splash = |step: &str, progress: u8| {
        let _ = handle.emit_to(
            tauri::EventTarget::labeled("splashscreen"),
            "splashscreen://progress",
            serde_json::json!({ "step": step, "progress": progress }),
        );
    };

    // 等待闪屏 JS listener 注册完毕再开始 emit，最多等 2 秒
    for _ in 0..200 {
        if SPLASH_READY.load(Ordering::Acquire) {
            break;
        }
        thread::sleep(Duration::from_millis(10));
    }

    emit_splash("start", 0);

    emit_splash("database", 20);
    let app_state = state::build_app_state(&handle)
        .map_err(|err| -> Box<dyn std::error::Error + Send + Sync> { Box::new(err) })?;

    emit_splash("proxy", 65);
    start_proxy_daemon_sidecar(&handle, &app_state).map_err(
        |err| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::new(std::io::ErrorKind::Other, err))
        },
    )?;
    handle.manage(app_state);

    // 启动后台任务：连接所有已启用的 MCP 服务器
    {
        let mcp_handle = handle.clone();
        tauri::async_runtime::spawn(async move {
            let state = mcp_handle.state::<state::AppState>();
            state.mcp_manager.refresh_all_enabled().await;
        });
    }

    // 预热本机 IP 地理缓存，使首次打开档案时能立即用到建议值
    {
        let locale_handle = handle.clone();
        tauri::async_runtime::spawn(async move {
            let state = locale_handle.state::<state::AppState>();
            state.host_locale_service.warm_up().await;
        });
    }

    emit_splash("menu", 80);
    setup_native_menu(&handle, None).map_err(
        |err| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                err.to_string(),
            ))
        },
    )?;
    start_runtime_guard(handle.clone());

    emit_splash("window", 90);
    build_main_window(&handle).map_err(|err| -> Box<dyn std::error::Error + Send + Sync> {
        Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            err.to_string(),
        ))
    })?;

    emit_splash("ready", 100);

    // 延迟 400ms 让进度条动画完成，然后通知主窗口 React 可以切换了
    // splash 关闭和主窗口显示统一由 show_main_window 命令处理，避免两步之间的空档
    thread::sleep(Duration::from_millis(400));
    INIT_COMPLETE.store(true, Ordering::Release);
    // 通知主窗口（React 可能已就绪在等待，也可能还未就绪会自行 poll）
    if let Some(main) = handle.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.emit("splashscreen://init-complete", ());
    }

    let fallback_handle = handle.clone();
    let _ = thread::Builder::new()
        .name("multi-flow-main-window-init-fallback".to_string())
        .spawn(move || {
            thread::sleep(Duration::from_secs(5));
            show_main_window_if_needed(&fallback_handle, "init-fallback");
        });

    logger::info("app", "tauri setup completed");
    Ok(())
}
