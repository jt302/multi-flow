use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{
    now_ts, CookieStateFile, EngineRuntimeHandle, EngineSession, ExportProfileCookiesMode,
    ProfileWindow, ProfileWindowState, WindowBounds, WindowTab,
};
use serde_json::{json, Value};

const DEFAULT_TAB_URL: &str = "https://www.browserscan.net/";
const MAGIC_HTTP_REQUEST_TIMEOUT_SECS: u64 = 2;
const MAGIC_HTTP_MAX_RETRIES: usize = 8;
const MAGIC_HTTP_RETRY_DELAY_MS: u64 = 120;
const MAGIC_HTTP_PATHS: [&str; 4] = ["/", "/cmd", "/command", "/magic"];
const SAFE_QUIT_WAIT_TIMEOUT_MS: u64 = 3_000;
const SAFE_QUIT_POLL_INTERVAL_MS: u64 = 100;

struct SessionRecord {
    session: EngineSession,
    profile_name: String,
    process: EngineProcess,
    launch_args: Vec<String>,
    extra_args: Vec<String>,
    windows: Vec<WindowRecord>,
    next_window_id: u64,
    next_tab_id: u64,
}

#[derive(Clone, Debug)]
struct WindowRecord {
    window_id: u64,
    focused: bool,
    bounds: Option<WindowBounds>,
    tabs: Vec<TabRecord>,
}

#[derive(Clone, Debug)]
struct TabRecord {
    tab_id: u64,
    title: String,
    url: String,
    active: bool,
}

enum EngineProcess {
    Mock,
    Chromium {
        child: Child,
        debug_port: u16,
        magic_port: u16,
    },
    /// 应用重启后从 DB 恢复的孤儿进程：有端口信息但无子进程句柄。
    Orphan {
        debug_port: u16,
        magic_port: u16,
    },
}

#[derive(Debug, Clone, Default)]
pub struct EngineLaunchOptions {
    pub user_agent: Option<String>,
    pub language: Option<String>,
    pub timezone_id: Option<String>,
    pub startup_urls: Vec<String>,
    pub proxy_server: Option<String>,
    pub web_rtc_policy: Option<String>,
    pub headless: bool,
    pub disable_images: bool,
    pub toolbar_text: Option<String>,
    pub background_color: Option<String>,
    pub custom_cpu_cores: Option<u32>,
    pub custom_ram_gb: Option<u32>,
    pub custom_font_list: Option<Vec<String>>,
    pub cookie_state_file: Option<PathBuf>,
    pub extension_state_file: Option<PathBuf>,
    pub bookmark_state_file: Option<PathBuf>,
    pub dock_icon_text: Option<String>,
    pub dock_icon_text_color: Option<String>,
    pub extra_args: Vec<String>,
    pub logging_enabled: bool,
}

pub struct EngineManager {
    sessions: HashMap<String, SessionRecord>,
    next_session_id: u64,
    chromium_executable: Option<PathBuf>,
    profiles_root_dir: Option<PathBuf>,
    next_debug_port: u16,
    next_magic_port: u16,
}

impl EngineManager {
    fn profile_name_for(&self, profile_id: &str) -> Option<&str> {
        self.sessions
            .get(profile_id)
            .map(|record| record.profile_name.as_str())
    }

    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            next_session_id: 1,
            chromium_executable: None,
            profiles_root_dir: None,
            next_debug_port: 19222,
            next_magic_port: 19322,
        }
    }

    #[allow(dead_code)]
    pub fn with_chromium(chromium_executable: PathBuf, profiles_root_dir: PathBuf) -> Self {
        Self {
            sessions: HashMap::new(),
            next_session_id: 1,
            chromium_executable: Some(chromium_executable),
            profiles_root_dir: Some(profiles_root_dir),
            next_debug_port: 19222,
            next_magic_port: 19322,
        }
    }

    pub fn with_profiles_root(profiles_root_dir: PathBuf) -> Self {
        Self {
            sessions: HashMap::new(),
            next_session_id: 1,
            chromium_executable: None,
            profiles_root_dir: Some(profiles_root_dir),
            next_debug_port: 19222,
            next_magic_port: 19322,
        }
    }

    pub fn set_chromium_executable(&mut self, executable: Option<PathBuf>) {
        self.chromium_executable = executable;
    }

    #[allow(dead_code)]
    pub fn open_profile(&mut self, profile_id: &str) -> AppResult<EngineSession> {
        self.open_profile_with_options(profile_id, &EngineLaunchOptions::default())
    }

    pub fn open_profile_with_options(
        &mut self,
        profile_id: &str,
        options: &EngineLaunchOptions,
    ) -> AppResult<EngineSession> {
        let profile_name = options
            .toolbar_text
            .as_deref()
            .and_then(trim_to_option)
            .unwrap_or_else(|| profile_id.to_string());
        logger::info(
            "engine_manager",
            format!(
                "open_profile start profile_id={profile_id} profile_name=\"{profile_name}\" options={options:?}"
            ),
        );
        if self.sessions.contains_key(profile_id) {
            logger::warn(
                "engine_manager",
                format!(
                    "open_profile rejected, profile_id={profile_id} profile_name=\"{profile_name}\" already running"
                ),
            );
            return Err(AppError::Conflict(format!(
                "profile already running: {profile_id}"
            )));
        }

        let session_id = self.next_session_id;
        self.next_session_id += 1;

        let process = if let Some(child) = self.spawn_chromium_if_configured(profile_id, options)? {
            child
        } else {
            logger::warn(
                "engine_manager",
                format!(
                    "chromium not configured, fallback to mock process profile_id={profile_id}"
                ),
            );
            (EngineProcess::Mock, Vec::new())
        };
        let (process, launch_args) = process;
        let pid = match &process {
            EngineProcess::Chromium { child, .. } => Some(child.id()),
            EngineProcess::Mock | EngineProcess::Orphan { .. } => None,
        };
        let (debug_port, magic_port) = match &process {
            EngineProcess::Chromium {
                debug_port,
                magic_port,
                ..
            }
            | EngineProcess::Orphan {
                debug_port,
                magic_port,
            } => (Some(*debug_port), Some(*magic_port)),
            EngineProcess::Mock => (None, None),
        };
        let session = EngineSession {
            profile_id: profile_id.to_string(),
            session_id,
            pid,
            started_at: now_ts(),
            debug_port,
            magic_port,
        };
        self.sessions.insert(
            profile_id.to_string(),
            SessionRecord {
                session: session.clone(),
                profile_name: profile_name.clone(),
                process,
                launch_args,
                extra_args: options.extra_args.clone(),
                windows: build_default_windows(options.startup_urls.clone()),
                next_window_id: 2,
                next_tab_id: options.startup_urls.len().max(1) as u64 + 1,
            },
        );
        logger::info(
            "engine_manager",
            format!(
                "open_profile success profile_id={profile_id} profile_name=\"{profile_name}\" session_id={} pid={:?}",
                session.session_id, session.pid
            ),
        );

        Ok(session)
    }

    /// 从持久化数据恢复一个已有浏览器进程的 session（应用重启后调用，不创建新进程）。
    /// 仅当 debug_port 和 magic_port 均存在时才能完整恢复 CDP/Magic 能力。
    pub fn restore_session(&mut self, session: EngineSession, profile_name: String) {
        if self.sessions.contains_key(&session.profile_id) {
            return;
        }
        let process = match (session.debug_port, session.magic_port) {
            (Some(debug_port), Some(magic_port)) => EngineProcess::Orphan {
                debug_port,
                magic_port,
            },
            _ => EngineProcess::Mock,
        };
        logger::info(
            "engine_manager",
            format!(
                "restore_session profile_id={} pid={:?} debug_port={:?} magic_port={:?}",
                session.profile_id, session.pid, session.debug_port, session.magic_port
            ),
        );
        self.sessions.insert(
            session.profile_id.clone(),
            SessionRecord {
                profile_name,
                process,
                session,
                launch_args: vec![],
                extra_args: vec![],
                windows: vec![],
                next_window_id: 1,
                next_tab_id: 1,
            },
        );
    }

    pub fn close_profile(&mut self, profile_id: &str) -> AppResult<EngineSession> {
        logger::info(
            "engine_manager",
            format!("close_profile start profile_id={profile_id}"),
        );
        let record = self.sessions.remove(profile_id).ok_or_else(|| {
            AppError::NotFound(format!("running session not found: {profile_id}"))
        })?;
        let profile_name = record.profile_name.clone();
        let pid = record.session.pid;

        // 将 Chromium 进程的实际关闭（最多等待 3 秒）放入后台线程，
        // 避免持有 engine_manager 锁阻塞其他操作和前端 IPC 响应。
        let profile_id_owned = profile_id.to_string();
        match record.process {
            EngineProcess::Chromium {
                mut child,
                debug_port,
                magic_port,
            } => {
                std::thread::spawn(move || {
                    shutdown_chromium_process(
                        &profile_id_owned,
                        &profile_name,
                        &mut child,
                        debug_port,
                        magic_port,
                    );
                });
            }
            EngineProcess::Orphan { .. } => {
                // 孤儿进程：没有子进程句柄，直接用 PID 发送终止信号
                if let Some(p) = pid {
                    crate::runtime_guard::terminate_process(p);
                }
            }
            EngineProcess::Mock => {}
        }
        logger::info(
            "engine_manager",
            format!(
                "close_profile detached shutdown profile_id={profile_id} session_id={} pid={pid:?}",
                record.session.session_id,
            ),
        );

        Ok(record.session)
    }

    pub fn is_running(&self, profile_id: &str) -> bool {
        self.sessions.contains_key(profile_id)
    }

    pub fn active_session_count(&self) -> usize {
        self.sessions.len()
    }

    pub fn get_runtime_handle(&self, profile_id: &str) -> AppResult<EngineRuntimeHandle> {
        let record = self.sessions.get(profile_id).ok_or_else(|| {
            AppError::NotFound(format!("running session not found: {profile_id}"))
        })?;
        let (debug_port, magic_port) = match &record.process {
            EngineProcess::Mock => (None, None),
            EngineProcess::Orphan {
                debug_port,
                magic_port,
            }
            | EngineProcess::Chromium {
                debug_port,
                magic_port,
                ..
            } => (Some(*debug_port), Some(*magic_port)),
        };
        Ok(EngineRuntimeHandle {
            profile_id: record.session.profile_id.clone(),
            session_id: record.session.session_id,
            pid: record.session.pid,
            debug_port,
            magic_port,
        })
    }

    pub fn get_runtime_launch_args(&self, profile_id: &str) -> AppResult<Option<Vec<String>>> {
        let Some(record) = self.sessions.get(profile_id) else {
            return Ok(None);
        };
        match record.process {
            EngineProcess::Chromium { .. } => Ok(Some(record.launch_args.clone())),
            EngineProcess::Mock | EngineProcess::Orphan { .. } => Ok(None),
        }
    }

    pub fn get_runtime_extra_args(&self, profile_id: &str) -> AppResult<Option<Vec<String>>> {
        let Some(record) = self.sessions.get(profile_id) else {
            return Ok(None);
        };
        match record.process {
            EngineProcess::Chromium { .. } => Ok(Some(record.extra_args.clone())),
            EngineProcess::Mock | EngineProcess::Orphan { .. } => Ok(None),
        }
    }

    pub fn export_profile_cookie_state(
        &self,
        profile_id: &str,
        mode: ExportProfileCookiesMode,
        url: Option<&str>,
        environment_id: Option<&str>,
    ) -> AppResult<CookieStateFile> {
        let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? else {
            return Err(AppError::NotFound(format!(
                "running session not found: {profile_id}"
            )));
        };
        let mut payload = match mode {
            ExportProfileCookiesMode::All => json!({
                "cmd": "export_cookie_state",
                "mode": "all",
            }),
            ExportProfileCookiesMode::Site => json!({
                "cmd": "export_cookie_state",
                "mode": "url",
                "url": url.unwrap_or_default(),
            }),
        };
        if let Some(value) = environment_id.and_then(trim_to_option) {
            payload["environment_id"] = Value::String(value);
        }
        let response = self.chromium_magic_command(profile_id, magic_port, payload)?;
        let data = response.get("data").cloned().ok_or_else(|| {
            AppError::Validation(format!(
                "magic export_cookie_state missing data profile_id={profile_id}"
            ))
        })?;
        serde_json::from_value::<CookieStateFile>(data).map_err(|err| {
            AppError::Validation(format!(
                "magic export_cookie_state invalid data profile_id={profile_id}: {err}"
            ))
        })
    }

    pub fn profile_data_dirs(&self, profile_id: &str) -> AppResult<(PathBuf, PathBuf, PathBuf)> {
        let profiles_root_dir = self.profiles_root_dir.as_ref().ok_or_else(|| {
            AppError::Validation("profiles root dir is not configured".to_string())
        })?;
        let profile_root_dir = profiles_root_dir.join(profile_id);
        Ok((
            profile_root_dir.clone(),
            profile_root_dir.join("user-data"),
            profile_root_dir.join("cache-data"),
        ))
    }

    pub fn list_window_states(&mut self) -> Vec<ProfileWindowState> {
        let exited_profiles = self.prune_exited_sessions();
        if !exited_profiles.is_empty() {
            logger::info(
                "engine_manager.window",
                format!(
                    "list_window_states pruned exited profiles before sync: {:?}",
                    exited_profiles
                ),
            );
        }
        let profile_ids = self.sessions.keys().cloned().collect::<Vec<_>>();
        let mut states = Vec::with_capacity(profile_ids.len());
        for profile_id in profile_ids {
            let Ok(Some(magic_port)) = self.chromium_magic_port_for_profile(&profile_id) else {
                if let Some(record) = self.sessions.get(&profile_id) {
                    states.push(profile_window_state(&profile_id, record));
                }
                continue;
            };
            match self.sync_chromium_window_state(&profile_id, magic_port) {
                Ok(state) => states.push(state),
                Err(err) => {
                    logger::warn(
                        "engine_manager.window",
                        format!(
                            "list_window_states fallback to cached state profile_id={profile_id}: {err}"
                        ),
                    );
                    if let Some(record) = self.sessions.get(&profile_id) {
                        states.push(profile_window_state(&profile_id, record));
                    }
                }
            }
        }
        states.sort_by(|a, b| a.profile_id.cmp(&b.profile_id));
        states
    }

    pub fn open_tab(
        &mut self,
        profile_id: &str,
        url: Option<String>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("open_tab start profile_id={profile_id} url={url:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let new_url = normalize_url(url)?;
            let cmd = json!({
                "cmd": "open_new_tab",
                "url": new_url,
            });
            self.chromium_magic_command(profile_id, magic_port, cmd)?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "open_tab success profile_id={profile_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let window = focused_window_mut(&mut record.windows)?;
        let new_url = normalize_url(url)?;
        deactivate_tabs(&mut window.tabs);
        let tab = TabRecord {
            tab_id: record.next_tab_id,
            title: derive_tab_title(&new_url),
            url: new_url,
            active: true,
        };
        record.next_tab_id = record.next_tab_id.saturating_add(1);
        window.tabs.push(tab);
        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "open_tab success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn close_tab(
        &mut self,
        profile_id: &str,
        tab_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("close_tab start profile_id={profile_id} tab_id={tab_id:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            let focused_window = snapshot
                .windows
                .iter()
                .find(|window| window.focused)
                .or_else(|| snapshot.windows.first())
                .ok_or_else(|| AppError::NotFound("no windows found for profile".to_string()))?;
            let resolved_tab_id = match tab_id {
                Some(value) => value,
                None => focused_window
                    .active_tab_id
                    .or_else(|| {
                        snapshot
                            .windows
                            .iter()
                            .flat_map(|window| window.tabs.iter())
                            .find(|tab| tab.active)
                            .map(|tab| tab.tab_id)
                    })
                    .ok_or_else(|| AppError::NotFound("active tab not found".to_string()))?,
            };
            if let Some(target_window) = snapshot
                .windows
                .iter()
                .find(|window| window.tabs.iter().any(|tab| tab.tab_id == resolved_tab_id))
            {
                if target_window.tab_count <= 1 {
                    return Err(AppError::Validation(
                        "cannot close the last tab of a profile window".to_string(),
                    ));
                }
            }
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "close_tab",
                    "tab_id": resolved_tab_id,
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "close_tab success profile_id={profile_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let window = focused_window_mut(&mut record.windows)?;
        if window.tabs.len() <= 1 {
            logger::warn(
                "engine_manager.window",
                format!("close_tab rejected profile_id={profile_id}: cannot close last tab"),
            );
            return Err(AppError::Validation(
                "cannot close the last tab of a profile window".to_string(),
            ));
        }

        let target_tab_id = match tab_id {
            Some(value) => value,
            None => window
                .tabs
                .iter()
                .find(|tab| tab.active)
                .map(|tab| tab.tab_id)
                .ok_or_else(|| AppError::NotFound("active tab not found".to_string()))?,
        };
        let index = window
            .tabs
            .iter()
            .position(|tab| tab.tab_id == target_tab_id)
            .ok_or_else(|| AppError::NotFound(format!("tab not found: {target_tab_id}")))?;
        let was_active = window.tabs[index].active;
        window.tabs.remove(index);
        if was_active {
            if let Some(last) = window.tabs.last_mut() {
                last.active = true;
            }
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "close_tab success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn close_inactive_tabs(
        &mut self,
        profile_id: &str,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("close_inactive_tabs start profile_id={profile_id} window_id={window_id:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            let target_window_id = resolve_target_window_id(&snapshot.windows, window_id)?;
            self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "close_inactive_tabs",
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "close_inactive_tabs success profile_id={profile_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let window_idx = resolve_window_index(&record.windows, window_id)?;
        let window = &mut record.windows[window_idx];
        if window.tabs.is_empty() {
            logger::warn(
                "engine_manager.window",
                format!("close_inactive_tabs rejected profile_id={profile_id}: no tabs"),
            );
            return Err(AppError::NotFound("no tabs found in window".to_string()));
        }
        if !window.tabs.iter().any(|tab| tab.active) {
            if let Some(first) = window.tabs.first_mut() {
                first.active = true;
            }
        }
        window.tabs.retain(|tab| tab.active);
        if window.tabs.is_empty() {
            logger::warn(
                "engine_manager.window",
                format!(
                    "close_inactive_tabs rejected profile_id={profile_id}: no active tab remains"
                ),
            );
            return Err(AppError::Validation(
                "cannot close tabs: no active tab remains".to_string(),
            ));
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "close_inactive_tabs success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn activate_tab(&mut self, profile_id: &str, tab_id: u64) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("activate_tab start profile_id={profile_id} tab_id={tab_id}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "activate_tab",
                    "tab_id": tab_id,
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "activate_tab success profile_id={profile_id} active_tab={tab_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let mut found = false;
        for window in &mut record.windows {
            let contains = window.tabs.iter().any(|tab| tab.tab_id == tab_id);
            window.focused = contains;
            for tab in &mut window.tabs {
                tab.active = contains && tab.tab_id == tab_id;
                if tab.active {
                    found = true;
                }
            }
        }
        if !found {
            logger::warn(
                "engine_manager.window",
                format!("activate_tab rejected profile_id={profile_id}: tab not found {tab_id}"),
            );
            return Err(AppError::NotFound(format!("tab not found: {tab_id}")));
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "activate_tab success profile_id={profile_id} active_tab={tab_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn activate_tab_by_index(
        &mut self,
        profile_id: &str,
        index: usize,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!(
                "activate_tab_by_index start profile_id={profile_id} index={index} window_id={window_id:?}"
            ),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            if let Some(target_window_id) = window_id {
                self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            }
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "activate_tab_by_index",
                    "index": index,
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "activate_tab_by_index success profile_id={profile_id} index={index} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let window_idx = resolve_window_index(&record.windows, window_id)?;
        let tab_count = record.windows[window_idx].tabs.len();
        if index >= tab_count {
            logger::warn(
                "engine_manager.window",
                format!(
                    "activate_tab_by_index rejected profile_id={profile_id}: index={index} tab_count={tab_count}"
                ),
            );
            return Err(AppError::Validation(format!(
                "tab index out of range: {index}"
            )));
        }

        for (idx, window) in record.windows.iter_mut().enumerate() {
            let is_target_window = idx == window_idx;
            window.focused = is_target_window;
            for (tab_idx, tab) in window.tabs.iter_mut().enumerate() {
                tab.active = is_target_window && tab_idx == index;
            }
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "activate_tab_by_index success profile_id={profile_id} index={index} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn open_window(
        &mut self,
        profile_id: &str,
        url: Option<String>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("open_window start profile_id={profile_id} url={url:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "open_new_window",
                }),
            )?;
            let new_url = normalize_url(url)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "open_new_tab",
                    "url": new_url,
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "open_window success profile_id={profile_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let new_url = normalize_url(url)?;
        for window in &mut record.windows {
            window.focused = false;
        }
        record.windows.push(WindowRecord {
            window_id: record.next_window_id,
            focused: true,
            bounds: None,
            tabs: vec![TabRecord {
                tab_id: record.next_tab_id,
                title: derive_tab_title(&new_url),
                url: new_url,
                active: true,
            }],
        });
        record.next_window_id = record.next_window_id.saturating_add(1);
        record.next_tab_id = record.next_tab_id.saturating_add(1);

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "open_window success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn close_window(
        &mut self,
        profile_id: &str,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("close_window start profile_id={profile_id} window_id={window_id:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            if snapshot.total_windows <= 1 {
                return Err(AppError::Validation(
                    "cannot close the last window of a profile session".to_string(),
                ));
            }
            let target_window_id = resolve_target_window_id(&snapshot.windows, window_id)?;
            self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "set_closed",
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "close_window success profile_id={profile_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        if record.windows.len() <= 1 {
            logger::warn(
                "engine_manager.window",
                format!("close_window rejected profile_id={profile_id}: cannot close last window"),
            );
            return Err(AppError::Validation(
                "cannot close the last window of a profile session".to_string(),
            ));
        }
        let target_window_id = match window_id {
            Some(value) => value,
            None => record
                .windows
                .iter()
                .find(|window| window.focused)
                .map(|window| window.window_id)
                .ok_or_else(|| AppError::NotFound("focused window not found".to_string()))?,
        };
        let index = record
            .windows
            .iter()
            .position(|window| window.window_id == target_window_id)
            .ok_or_else(|| AppError::NotFound(format!("window not found: {target_window_id}")))?;
        let was_focused = record.windows[index].focused;
        record.windows.remove(index);
        if was_focused {
            if let Some(first) = record.windows.first_mut() {
                first.focused = true;
            }
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "close_window success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn focus_window(
        &mut self,
        profile_id: &str,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("focus_window start profile_id={profile_id} window_id={window_id:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            let target_window_id = resolve_target_window_id(&snapshot.windows, window_id)?;
            self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "focus_window success profile_id={profile_id} target_window_id={target_window_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }
        let record = self.session_record_mut(profile_id)?;
        let target_window_id = match window_id {
            Some(value) => value,
            None => record
                .windows
                .first()
                .map(|window| window.window_id)
                .ok_or_else(|| AppError::NotFound("no windows found for profile".to_string()))?,
        };
        let mut found = false;
        for window in &mut record.windows {
            let matched = window.window_id == target_window_id;
            window.focused = matched;
            if matched {
                found = true;
            }
        }
        if !found {
            logger::warn(
                "engine_manager.window",
                format!(
                    "focus_window rejected profile_id={profile_id}: window not found {target_window_id}"
                ),
            );
            return Err(AppError::NotFound(format!(
                "window not found: {target_window_id}"
            )));
        }

        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "focus_window success profile_id={profile_id} target_window_id={target_window_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn set_window_bounds(
        &mut self,
        profile_id: &str,
        bounds: WindowBounds,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!(
                "set_window_bounds start profile_id={profile_id} window_id={window_id:?} bounds={bounds:?}"
            ),
        );
        if bounds.width <= 0 || bounds.height <= 0 {
            return Err(AppError::Validation(
                "window bounds width/height must be positive".to_string(),
            ));
        }
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            let target_window_id = resolve_target_window_id(&snapshot.windows, window_id)?;
            self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "set_bounds",
                    "x": bounds.x,
                    "y": bounds.y,
                    "width": bounds.width,
                    "height": bounds.height,
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "set_window_bounds success profile_id={profile_id} target_window_id={target_window_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }

        let record = self.session_record_mut(profile_id)?;
        let window_idx = resolve_window_index(&record.windows, window_id)?;
        record.windows[window_idx].bounds = Some(bounds);
        let state = profile_window_state(profile_id, record);
        logger::info(
            "engine_manager.window",
            format!(
                "set_window_bounds success profile_id={profile_id} total_windows={} total_tabs={}",
                state.total_windows, state.total_tabs
            ),
        );
        Ok(state)
    }

    pub fn restore_window(
        &mut self,
        profile_id: &str,
        window_id: Option<u64>,
    ) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!("restore_window start profile_id={profile_id} window_id={window_id:?}"),
        );
        if let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? {
            let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
            let target_window_id = resolve_target_window_id(&snapshot.windows, window_id)?;
            self.activate_window_for_chromium(profile_id, magic_port, target_window_id)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "set_restored",
                }),
            )?;
            let state = self.sync_chromium_window_state(profile_id, magic_port)?;
            logger::info(
                "engine_manager.window",
                format!(
                    "restore_window success profile_id={profile_id} target_window_id={target_window_id} total_windows={} total_tabs={}",
                    state.total_windows, state.total_tabs
                ),
            );
            return Ok(state);
        }

        self.focus_window(profile_id, window_id)
    }

    pub fn type_string(&mut self, profile_id: &str, text: &str) -> AppResult<ProfileWindowState> {
        logger::info(
            "engine_manager.window",
            format!(
                "type_string start profile_id={profile_id} text_len={}",
                text.len()
            ),
        );
        let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? else {
            return Err(AppError::Validation(
                "type_string requires a real chromium session".to_string(),
            ));
        };
        let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
        let active_tab_id = snapshot
            .windows
            .iter()
            .find(|window| window.focused)
            .and_then(|window| window.active_tab_id)
            .or_else(|| {
                snapshot
                    .windows
                    .iter()
                    .find_map(|window| window.active_tab_id)
            })
            .ok_or_else(|| AppError::NotFound("active tab not found".to_string()))?;
        self.chromium_magic_command(
            profile_id,
            magic_port,
            json!({
                "cmd": "type_string",
                "tab_id": active_tab_id,
                "text": text,
            }),
        )?;
        self.sync_chromium_window_state(profile_id, magic_port)
    }

    pub fn apply_profile_visual_overrides(
        &self,
        profile_id: &str,
        background_color: Option<String>,
        toolbar_text: Option<String>,
    ) -> AppResult<()> {
        let Some(magic_port) = self.chromium_magic_port_for_profile(profile_id)? else {
            return Ok(());
        };
        if let Some(color) = background_color.as_deref().and_then(trim_to_option) {
            let (r, g, b) = parse_hex_rgb(&color)?;
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "set_bg_color",
                    "r": r,
                    "g": g,
                    "b": b,
                }),
            )?;
        }
        if let Some(text) = toolbar_text.as_deref().and_then(trim_to_option) {
            self.chromium_magic_command(
                profile_id,
                magic_port,
                json!({
                    "cmd": "set_toolbar_text",
                    "text": text,
                }),
            )?;
        }
        Ok(())
    }

    pub fn prune_exited_sessions(&mut self) -> Vec<String> {
        let mut exited_profiles = Vec::new();
        for (profile_id, record) in self.sessions.iter_mut() {
            let should_prune = match &mut record.process {
                EngineProcess::Mock => false,
                EngineProcess::Orphan { magic_port, .. } => {
                    // 孤儿进程：通过 PID 存活检查来判断是否需要清理
                    let alive = record
                        .session
                        .pid
                        .map(crate::runtime_guard::is_process_alive)
                        .unwrap_or(false);
                    if !alive && !is_magic_server_alive(*magic_port) {
                        logger::info(
                            "engine_manager",
                            format!(
                                "orphan process exited profile_id={profile_id} pid={:?}",
                                record.session.pid
                            ),
                        );
                        true
                    } else {
                        false
                    }
                }
                EngineProcess::Chromium {
                    child, magic_port, ..
                } => match child.try_wait() {
                    Ok(Some(_)) => {
                        if is_magic_server_alive(*magic_port) {
                            logger::warn(
                                "engine_manager",
                                format!(
                                    "chromium child exited but magic server still alive, keep session profile_id={profile_id} magic_port={magic_port}"
                                ),
                            );
                            false
                        } else {
                            true
                        }
                    }
                    Ok(None) => false,
                    Err(err) => {
                        if is_magic_server_alive(*magic_port) {
                            logger::warn(
                                "engine_manager",
                                format!(
                                    "chromium child state check failed but magic server alive, keep session profile_id={profile_id} magic_port={magic_port} err={err}"
                                ),
                            );
                            false
                        } else {
                            true
                        }
                    }
                },
            };
            if should_prune {
                logger::warn(
                    "engine_manager",
                    format!(
                        "detected exited chromium process profile_id={profile_id} session_id={} pid={:?}",
                        record.session.session_id, record.session.pid
                    ),
                );
                exited_profiles.push(profile_id.clone());
            }
        }

        for profile_id in &exited_profiles {
            self.sessions.remove(profile_id);
        }
        if !exited_profiles.is_empty() {
            logger::info(
                "engine_manager",
                format!("pruned exited profiles: {:?}", exited_profiles),
            );
        }

        exited_profiles
    }

    fn chromium_magic_port_for_profile(&self, profile_id: &str) -> AppResult<Option<u16>> {
        let record = self.sessions.get(profile_id).ok_or_else(|| {
            AppError::NotFound(format!("running session not found: {profile_id}"))
        })?;
        match &record.process {
            EngineProcess::Mock => Ok(None),
            EngineProcess::Chromium { magic_port, .. }
            | EngineProcess::Orphan { magic_port, .. } => Ok(Some(*magic_port)),
        }
    }

    fn activate_window_for_chromium(
        &self,
        profile_id: &str,
        magic_port: u16,
        target_window_id: u64,
    ) -> AppResult<()> {
        let snapshot = self.fetch_chromium_window_state(profile_id, magic_port)?;
        let target_window = snapshot
            .windows
            .iter()
            .find(|window| window.window_id == target_window_id)
            .ok_or_else(|| AppError::NotFound(format!("window not found: {target_window_id}")))?;
        let target_tab_id = target_window
            .active_tab_id
            .or_else(|| target_window.tabs.first().map(|tab| tab.tab_id))
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "window has no tabs to activate: {target_window_id}"
                ))
            })?;
        self.chromium_magic_command(
            profile_id,
            magic_port,
            json!({
                "cmd": "activate_tab",
                "tab_id": target_tab_id,
            }),
        )?;
        Ok(())
    }

    fn sync_chromium_window_state(
        &mut self,
        profile_id: &str,
        magic_port: u16,
    ) -> AppResult<ProfileWindowState> {
        let state = self.fetch_chromium_window_state(profile_id, magic_port)?;
        if let Some(record) = self.sessions.get_mut(profile_id) {
            record.windows = state
                .windows
                .iter()
                .map(|window| WindowRecord {
                    window_id: window.window_id,
                    focused: window.focused,
                    bounds: window.bounds.clone(),
                    tabs: window
                        .tabs
                        .iter()
                        .map(|tab| TabRecord {
                            tab_id: tab.tab_id,
                            title: tab.title.clone(),
                            url: tab.url.clone(),
                            active: tab.active,
                        })
                        .collect(),
                })
                .collect();
        }
        Ok(state)
    }

    fn fetch_chromium_window_state(
        &self,
        profile_id: &str,
        magic_port: u16,
    ) -> AppResult<ProfileWindowState> {
        let record = self.sessions.get(profile_id).ok_or_else(|| {
            AppError::NotFound(format!("running session not found: {profile_id}"))
        })?;
        let payload = json!({
            "cmd": "get_browsers",
        });
        let response = self.chromium_magic_command(profile_id, magic_port, payload)?;
        let data = response
            .get("data")
            .and_then(Value::as_array)
            .ok_or_else(|| {
                AppError::Validation("magic get_browsers missing data array".to_string())
            })?;
        let windows = data
            .iter()
            .filter_map(parse_magic_window)
            .collect::<Vec<_>>();
        let total_tabs = windows.iter().map(|item| item.tab_count).sum::<usize>();
        Ok(ProfileWindowState {
            profile_id: profile_id.to_string(),
            session_id: record.session.session_id,
            pid: record.session.pid,
            total_windows: windows.len(),
            total_tabs,
            windows,
        })
    }

    fn chromium_magic_command(
        &self,
        profile_id: &str,
        magic_port: u16,
        payload: Value,
    ) -> AppResult<Value> {
        let cmd = payload
            .get("cmd")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        let payload_string = payload.to_string();
        let mut last_error_message = String::new();
        for attempt in 1..=MAGIC_HTTP_MAX_RETRIES {
            for path in MAGIC_HTTP_PATHS {
                let response = match send_magic_http_request(magic_port, path, &payload) {
                    Ok(result) => result,
                    Err(err) => {
                        last_error_message = err.to_string();
                        continue;
                    }
                };
                if response.status_code == 404 {
                    continue;
                }
                if !(200..=299).contains(&response.status_code) {
                    last_error_message = format!(
                        "status={} path={} body={}",
                        response.status_code, path, response.body
                    );
                    continue;
                }
                let parsed = serde_json::from_str::<Value>(&response.body).map_err(|err| {
                    AppError::Validation(format!(
                        "magic response is not valid json profile_id={profile_id} cmd={cmd} path={path}: {err}"
                    ))
                })?;
                if parsed.get("status").and_then(Value::as_str) != Some("ok") {
                    let message = parsed
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown magic error");
                    return Err(AppError::Validation(format!(
                        "magic command failed profile_id={profile_id} cmd={cmd} path={path}: {message}"
                    )));
                }
                logger::info(
                    "engine_manager.magic",
                    format!(
                        "command success profile_id={profile_id} profile_name=\"{}\" cmd={cmd} path={path} payload={payload_string}",
                        self.profile_name_for(profile_id).unwrap_or(profile_id)
                    ),
                );
                return Ok(parsed);
            }
            if attempt < MAGIC_HTTP_MAX_RETRIES {
                std::thread::sleep(Duration::from_millis(MAGIC_HTTP_RETRY_DELAY_MS));
            }
        }
        Err(AppError::Validation(format!(
            "magic command failed profile_id={profile_id} cmd={cmd} port={magic_port}: {last_error_message}"
        )))
    }

    fn should_forward_chromium_output(logging_enabled: bool, value: &str) -> bool {
        if logging_enabled {
            return true;
        }

        let upper = value.to_ascii_uppercase();
        upper.contains("ERROR")
            || upper.contains("FATAL")
            || upper.contains("CRASH")
            || upper.contains("EXCEPTION")
    }

    fn spawn_chromium_if_configured(
        &mut self,
        profile_id: &str,
        options: &EngineLaunchOptions,
    ) -> AppResult<Option<(EngineProcess, Vec<String>)>> {
        let profile_name = options
            .toolbar_text
            .as_deref()
            .and_then(trim_to_option)
            .unwrap_or_else(|| profile_id.to_string());
        let (Some(executable), Some(profiles_root_dir)) = (
            self.chromium_executable.as_ref(),
            self.profiles_root_dir.as_ref(),
        ) else {
            logger::warn(
                "engine_manager",
                format!(
                    "skip chromium spawn: executable or profiles root missing profile_id={profile_id}"
                ),
            );
            return Ok(None);
        };

        let profile_root_dir = profiles_root_dir.join(profile_id);
        let user_data_dir = profile_root_dir.join("user-data");
        let cache_data_dir = profile_root_dir.join("cache-data");
        fs::create_dir_all(&user_data_dir)?;
        fs::create_dir_all(&cache_data_dir)?;

        let debug_port = self.next_debug_port;
        self.next_debug_port = self.next_debug_port.saturating_add(1);
        let magic_port = self.next_magic_port;
        self.next_magic_port = self.next_magic_port.saturating_add(1);

        let args = build_chromium_launch_args(
            &user_data_dir,
            &cache_data_dir,
            debug_port,
            magic_port,
            options,
        )?;

        let timezone = options
            .timezone_id
            .as_ref()
            .and_then(|value| trim_to_option(value));
        logger::info(
            "engine_manager.launch",
            format!(
                "spawn chromium profile_id={profile_id} profile_name=\"{profile_name}\" executable={} args={:?} env_TZ={:?} magic_port={magic_port}",
                executable.to_string_lossy(),
                args,
                timezone
            ),
        );
        let mut command = Command::new(executable);
        command
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(timezone_id) = timezone {
            command.env("TZ", timezone_id);
        }
        let mut child = command.spawn().map_err(|err| {
            logger::error(
                "engine_manager.launch",
                format!(
                    "spawn chromium failed profile_id={profile_id} profile_name=\"{profile_name}\": {err}"
                ),
            );
            AppError::Io(err)
        })?;
        let logging_enabled = options.logging_enabled;
        if let Some(stdout) = child.stdout.take() {
            let profile_id = profile_id.to_string();
            let profile_name = profile_name.clone();
            let logging_enabled = logging_enabled;
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.split(b'\n') {
                    match line {
                        Ok(bytes) => {
                            let value = String::from_utf8_lossy(&bytes);
                            let value = value.trim();
                            if value.is_empty() {
                                continue;
                            }
                            if !Self::should_forward_chromium_output(logging_enabled, value) {
                                continue;
                            }
                            logger::info(
                                "chromium.stdout",
                                format!("profile_id={profile_id} profile_name=\"{profile_name}\" {value}"),
                            );
                        }
                        Err(err) => {
                            logger::warn(
                                "chromium.stdout",
                                format!("profile_id={profile_id} profile_name=\"{profile_name}\" read failed: {err}"),
                            );
                            break;
                        }
                    }
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let profile_id = profile_id.to_string();
            let profile_name = profile_name.clone();
            let logging_enabled = logging_enabled;
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.split(b'\n') {
                    match line {
                        Ok(bytes) => {
                            let value = String::from_utf8_lossy(&bytes);
                            let value = value.trim();
                            if value.is_empty() {
                                continue;
                            }
                            if !Self::should_forward_chromium_output(logging_enabled, value) {
                                continue;
                            }
                            logger::warn(
                                "chromium.stderr",
                                format!("profile_id={profile_id} profile_name=\"{profile_name}\" {value}"),
                            );
                        }
                        Err(err) => {
                            logger::warn(
                                "chromium.stderr",
                                format!("profile_id={profile_id} profile_name=\"{profile_name}\" read failed: {err}"),
                            );
                            break;
                        }
                    }
                }
            });
        }
        logger::info(
            "engine_manager.launch",
            format!(
                "spawn chromium success profile_id={profile_id} profile_name=\"{profile_name}\" pid={} debug_port={debug_port} magic_port={magic_port}",
                child.id()
            ),
        );

        Ok(Some((
            EngineProcess::Chromium {
                child,
                debug_port,
                magic_port,
            },
            args,
        )))
    }

    fn session_record_mut(&mut self, profile_id: &str) -> AppResult<&mut SessionRecord> {
        self.sessions
            .get_mut(profile_id)
            .ok_or_else(|| AppError::NotFound(format!("running session not found: {profile_id}")))
    }
}

fn build_chromium_launch_args(
    user_data_dir: &std::path::Path,
    cache_data_dir: &std::path::Path,
    debug_port: u16,
    magic_port: u16,
    options: &EngineLaunchOptions,
) -> AppResult<Vec<String>> {
    let mut args = vec![
        format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
        format!("--disk-cache-dir={}", cache_data_dir.to_string_lossy()),
        format!("--remote-debugging-port={debug_port}"),
        format!("--magic-socket-server-port={magic_port}"),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
    ];
    if options.logging_enabled {
        args.push("--enable-logging=stderr".to_string());
        args.push("--v=1".to_string());
    }
    if let Some(language) = options
        .language
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        args.push(format!("--lang={language}"));
    }
    if let Some(user_agent) = options
        .user_agent
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        args.push(format!("--user-agent={user_agent}"));
    }
    if let Some(proxy_server) = options
        .proxy_server
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        args.push(format!("--proxy-server={proxy_server}"));
    }
    if let Some(policy) = options
        .web_rtc_policy
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        args.push(format!("--force-webrtc-ip-handling-policy={policy}"));
    }
    if options.headless {
        args.push("--headless=new".to_string());
    }
    if options.disable_images {
        args.push("--blink-settings=imagesEnabled=false".to_string());
    }
    if let Some(toolbar_text) = options
        .toolbar_text
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        args.push(format!("--toolbar-text={toolbar_text}"));
    }
    if let Some(color) = options
        .background_color
        .as_ref()
        .and_then(|value| trim_to_option(value))
    {
        let _ = parse_hex_rgb(&color)?;
        args.push(format!("--custom-bg-color={}", color.to_uppercase()));
    }
    if let Some(custom_cpu_cores) = options.custom_cpu_cores {
        args.push(format!("--custom-cpu-cores={custom_cpu_cores}"));
    }
    if let Some(custom_ram_gb) = options.custom_ram_gb {
        args.push(format!("--custom-ram-gb={custom_ram_gb}"));
    }
    if let Some(custom_font_list) = options.custom_font_list.as_ref() {
        let joined = custom_font_list
            .iter()
            .filter_map(|value| trim_to_option(value))
            .collect::<Vec<_>>()
            .join(",");
        if !joined.is_empty() {
            args.push(format!("--custom-font-list={joined}"));
        }
    }
    if let Some(cookie_state_file) = options.cookie_state_file.as_ref() {
        args.push(format!(
            "--cookie-state-file={}",
            cookie_state_file.to_string_lossy()
        ));
    }
    if let Some(extension_state_file) = options.extension_state_file.as_ref() {
        args.push(format!(
            "--extension-state-file={}",
            extension_state_file.to_string_lossy()
        ));
    }
    if let Some(bookmark_state_file) = options.bookmark_state_file.as_ref() {
        args.push(format!(
            "--bookmark-state-file={}",
            bookmark_state_file.to_string_lossy()
        ));
    }
    if let Some(text) = &options.dock_icon_text {
        args.push(format!("--custom-dock-icon-text={text}"));
    }
    if let Some(color) = &options.dock_icon_text_color {
        args.push(format!("--custom-dock-icon-text-color={color}"));
    }
    for extra in &options.extra_args {
        if let Some(arg) = trim_to_option(extra) {
            args.push(arg);
        }
    }
    for startup_url in &options.startup_urls {
        if let Some(value) = trim_to_option(startup_url) {
            args.push(value);
        }
    }
    Ok(args)
}

struct MagicHttpResponse {
    status_code: u16,
    body: String,
}

fn send_magic_http_request(port: u16, path: &str, payload: &Value) -> AppResult<MagicHttpResponse> {
    let url = format!("http://127.0.0.1:{port}{path}");
    let request_payload = payload.clone();
    crate::runtime_compat::block_on_compat(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(MAGIC_HTTP_REQUEST_TIMEOUT_SECS))
            .build()?;
        let response = client.post(url).json(&request_payload).send().await?;
        let status_code = response.status().as_u16();
        let body = response.text().await?;
        Ok::<MagicHttpResponse, AppError>(MagicHttpResponse { status_code, body })
    })
}

fn is_magic_server_alive(port: u16) -> bool {
    let payload = json!({ "cmd": "get_browsers" });
    for path in MAGIC_HTTP_PATHS {
        let response = match send_magic_http_request(port, path, &payload) {
            Ok(result) => result,
            Err(_) => continue,
        };
        if response.status_code == 404 || !(200..=299).contains(&response.status_code) {
            continue;
        }
        let parsed = match serde_json::from_str::<Value>(&response.body) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if parsed.get("status").and_then(Value::as_str) == Some("ok") {
            return true;
        }
    }
    false
}

fn try_magic_safe_quit(profile_id: &str, port: u16) -> AppResult<()> {
    let payload = json!({ "cmd": "safe_quit" });
    for path in MAGIC_HTTP_PATHS {
        let response = match send_magic_http_request(port, path, &payload) {
            Ok(result) => result,
            Err(_) => continue,
        };
        if response.status_code == 404 || !(200..=299).contains(&response.status_code) {
            continue;
        }
        let parsed = serde_json::from_str::<Value>(&response.body).map_err(|err| {
            AppError::Validation(format!(
                "magic safe_quit response parse failed profile_id={profile_id} path={path}: {err}"
            ))
        })?;
        if parsed.get("status").and_then(Value::as_str) == Some("ok") {
            logger::info(
                "engine_manager.magic",
                format!("magic safe_quit success profile_id={profile_id} path={path}"),
            );
            return Ok(());
        }
    }
    Err(AppError::Validation(format!(
        "magic safe_quit failed profile_id={profile_id} port={port}"
    )))
}

fn wait_for_child_exit(
    profile_id: &str,
    profile_name: &str,
    child: &mut Child,
    timeout: Duration,
    poll_interval: Duration,
) -> AppResult<bool> {
    let pid = child.id();
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                logger::info(
                    "engine_manager",
                    format!(
                        "chromium exited after safe_quit profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} status={status}"
                    ),
                );
                return Ok(true);
            }
            Ok(None) => {
                let now = Instant::now();
                if now >= deadline {
                    return Ok(false);
                }
                let remaining = deadline.saturating_duration_since(now);
                std::thread::sleep(poll_interval.min(remaining));
            }
            Err(err) => {
                return Err(AppError::Validation(format!(
                    "check chromium exit failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid}: {err}"
                )));
            }
        }
    }
}

fn force_kill_child(profile_id: &str, profile_name: &str, child: &mut Child) {
    let pid = child.id();
    match child.try_wait() {
        Ok(Some(status)) => {
            logger::info(
                "engine_manager",
                format!(
                    "chromium already exited before force kill profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} status={status}"
                ),
            );
            return;
        }
        Ok(None) => {}
        Err(err) => {
            logger::warn(
                "engine_manager",
                format!(
                    "pre-kill status check failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid}: {err}"
                ),
            );
        }
    }

    logger::warn(
        "engine_manager",
        format!(
            "force killing chromium profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid}"
        ),
    );
    if let Err(err) = child.kill() {
        logger::warn(
            "engine_manager",
            format!(
                "chromium force kill failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid}: {err}"
            ),
        );
    }
    match child.wait() {
        Ok(status) => {
            logger::info(
                "engine_manager",
                format!(
                    "chromium force kill completed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} status={status}"
                ),
            );
        }
        Err(err) => {
            logger::warn(
                "engine_manager",
                format!(
                    "chromium wait after force kill failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid}: {err}"
                ),
            );
        }
    }
}

fn shutdown_chromium_process(
    profile_id: &str,
    profile_name: &str,
    child: &mut Child,
    debug_port: u16,
    magic_port: u16,
) {
    let pid = child.id();
    let graceful_exit = match try_magic_safe_quit(profile_id, magic_port) {
        Ok(()) => match wait_for_child_exit(
            profile_id,
            profile_name,
            child,
            Duration::from_millis(SAFE_QUIT_WAIT_TIMEOUT_MS),
            Duration::from_millis(SAFE_QUIT_POLL_INTERVAL_MS),
        ) {
            Ok(true) => true,
            Ok(false) => {
                logger::warn(
                    "engine_manager",
                    format!(
                        "safe_quit timed out profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} debug_port={debug_port} magic_port={magic_port} timeout_ms={SAFE_QUIT_WAIT_TIMEOUT_MS}"
                    ),
                );
                false
            }
            Err(err) => {
                logger::warn(
                    "engine_manager",
                    format!(
                        "safe_quit wait failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} debug_port={debug_port} magic_port={magic_port}: {err}"
                    ),
                );
                false
            }
        },
        Err(err) => {
            logger::warn(
                "engine_manager",
                format!(
                    "safe_quit request failed profile_id={profile_id} profile_name=\"{profile_name}\" pid={pid} debug_port={debug_port} magic_port={magic_port}: {err}"
                ),
            );
            false
        }
    };

    if graceful_exit {
        return;
    }

    force_kill_child(profile_id, profile_name, child);
}

fn parse_magic_window(entry: &Value) -> Option<ProfileWindow> {
    let window_id = entry.get("id").and_then(value_to_u64)?;
    let focused = entry
        .get("isActive")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let bounds = entry.get("bounds").and_then(parse_magic_bounds);
    let tabs = entry
        .get("tabs")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(parse_magic_tab).collect::<Vec<_>>())
        .unwrap_or_default();
    let active_tab = tabs.iter().find(|tab| tab.active);
    Some(ProfileWindow {
        window_id,
        focused,
        tab_count: tabs.len(),
        active_tab_id: active_tab.map(|tab| tab.tab_id),
        active_tab_url: active_tab.map(|tab| tab.url.clone()),
        bounds,
        tabs,
    })
}

fn parse_magic_bounds(entry: &Value) -> Option<WindowBounds> {
    Some(WindowBounds {
        x: entry.get("x").and_then(value_to_i32)?,
        y: entry.get("y").and_then(value_to_i32)?,
        width: entry.get("width").and_then(value_to_i32)?,
        height: entry.get("height").and_then(value_to_i32)?,
    })
}

fn parse_magic_tab(entry: &Value) -> Option<WindowTab> {
    let tab_id = entry.get("id").and_then(value_to_u64)?;
    let title = entry
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let url = entry
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let active = entry
        .get("is_active")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Some(WindowTab {
        tab_id,
        title,
        url,
        active,
    })
}

fn value_to_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_i64().and_then(|item| u64::try_from(item).ok()))
}

fn value_to_i32(value: &Value) -> Option<i32> {
    value.as_i64().and_then(|item| i32::try_from(item).ok())
}

fn resolve_target_window_id(windows: &[ProfileWindow], window_id: Option<u64>) -> AppResult<u64> {
    match window_id {
        Some(value) => windows
            .iter()
            .find(|window| window.window_id == value)
            .map(|window| window.window_id)
            .ok_or_else(|| AppError::NotFound(format!("window not found: {value}"))),
        None => windows
            .iter()
            .find(|window| window.focused)
            .or_else(|| windows.first())
            .map(|window| window.window_id)
            .ok_or_else(|| AppError::NotFound("no windows found for profile".to_string())),
    }
}

fn parse_hex_rgb(input: &str) -> AppResult<(u8, u8, u8)> {
    let value = input.trim();
    if value.len() != 7 || !value.starts_with('#') {
        return Err(AppError::Validation(format!(
            "invalid browser background color: {value}"
        )));
    }
    let raw = &value[1..];
    if !raw.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(AppError::Validation(format!(
            "invalid browser background color: {value}"
        )));
    }
    let r = u8::from_str_radix(&raw[0..2], 16)
        .map_err(|_| AppError::Validation(format!("invalid browser background color: {value}")))?;
    let g = u8::from_str_radix(&raw[2..4], 16)
        .map_err(|_| AppError::Validation(format!("invalid browser background color: {value}")))?;
    let b = u8::from_str_radix(&raw[4..6], 16)
        .map_err(|_| AppError::Validation(format!("invalid browser background color: {value}")))?;
    Ok((r, g, b))
}

fn trim_to_option(input: &str) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn build_default_windows(startup_urls: Vec<String>) -> Vec<WindowRecord> {
    let normalized_urls = if startup_urls.is_empty() {
        vec![DEFAULT_TAB_URL.to_string()]
    } else {
        startup_urls
            .into_iter()
            .filter_map(|value| trim_to_option(&value))
            .map(|value| normalize_url(Some(value)).unwrap_or_else(|_| DEFAULT_TAB_URL.to_string()))
            .collect::<Vec<_>>()
    };
    let normalized_urls = if normalized_urls.is_empty() {
        vec![DEFAULT_TAB_URL.to_string()]
    } else {
        normalized_urls
    };

    let tabs = normalized_urls
        .into_iter()
        .enumerate()
        .map(|(index, url)| TabRecord {
            tab_id: index as u64 + 1,
            title: derive_tab_title(&url),
            url,
            active: index == 0,
        })
        .collect::<Vec<_>>();

    vec![WindowRecord {
        window_id: 1,
        focused: true,
        bounds: None,
        tabs,
    }]
}

fn normalize_url(url: Option<String>) -> AppResult<String> {
    let value = url
        .as_ref()
        .and_then(|candidate| trim_to_option(candidate))
        .unwrap_or_else(|| DEFAULT_TAB_URL.to_string());
    let parsed = reqwest::Url::parse(&value).map_err(|err| {
        AppError::Validation(format!(
            "url is not a valid http/https URL: {value} ({err})"
        ))
    })?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        Err(AppError::Validation(format!(
            "url must start with http:// or https://: {value}"
        )))
    } else if parsed.host_str().is_none() {
        Err(AppError::Validation(format!(
            "url must contain a valid host: {value}"
        )))
    } else {
        Ok(parsed.to_string())
    }
}

fn derive_tab_title(url: &str) -> String {
    let trimmed = url.trim();
    let without_schema = if let Some((_, rest)) = trimmed.split_once("://") {
        rest
    } else {
        trimmed
    };
    let host = without_schema.split('/').next().unwrap_or_default().trim();
    if host.is_empty() {
        "New Tab".to_string()
    } else {
        host.to_string()
    }
}

fn deactivate_tabs(tabs: &mut [TabRecord]) {
    for tab in tabs {
        tab.active = false;
    }
}

fn focused_window_mut(windows: &mut [WindowRecord]) -> AppResult<&mut WindowRecord> {
    windows
        .iter_mut()
        .find(|window| window.focused)
        .ok_or_else(|| AppError::NotFound("focused window not found".to_string()))
}

fn resolve_window_index(windows: &[WindowRecord], window_id: Option<u64>) -> AppResult<usize> {
    match window_id {
        Some(value) => windows
            .iter()
            .position(|window| window.window_id == value)
            .ok_or_else(|| AppError::NotFound(format!("window not found: {value}"))),
        None => windows
            .iter()
            .position(|window| window.focused)
            .ok_or_else(|| AppError::NotFound("focused window not found".to_string())),
    }
}

fn profile_window_state(profile_id: &str, record: &SessionRecord) -> ProfileWindowState {
    let windows = record
        .windows
        .iter()
        .map(|window| {
            let active_tab = window.tabs.iter().find(|tab| tab.active);
            ProfileWindow {
                window_id: window.window_id,
                focused: window.focused,
                tab_count: window.tabs.len(),
                active_tab_id: active_tab.map(|tab| tab.tab_id),
                active_tab_url: active_tab.map(|tab| tab.url.clone()),
                bounds: window.bounds.clone(),
                tabs: window
                    .tabs
                    .iter()
                    .map(|tab| WindowTab {
                        tab_id: tab.tab_id,
                        title: tab.title.clone(),
                        url: tab.url.clone(),
                        active: tab.active,
                    })
                    .collect(),
            }
        })
        .collect::<Vec<_>>();
    let total_tabs = windows.iter().map(|item| item.tab_count).sum::<usize>();
    ProfileWindowState {
        profile_id: profile_id.to_string(),
        session_id: record.session.session_id,
        pid: record.session.pid,
        total_windows: windows.len(),
        total_tabs,
        windows,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::path::PathBuf;
    use std::process::{Command, Stdio};
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::Instant;

    fn spawn_magic_test_server<F>(handler: F) -> (u16, thread::JoinHandle<()>)
    where
        F: FnOnce(String) -> (u16, String) + Send + 'static,
    {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test magic server");
        let port = listener.local_addr().expect("listener addr").port();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut buffer = Vec::new();
            let mut chunk = [0u8; 4096];
            let mut expected_total = None::<usize>;
            loop {
                let bytes_read = stream.read(&mut chunk).expect("read request");
                if bytes_read == 0 {
                    break;
                }
                buffer.extend_from_slice(&chunk[..bytes_read]);
                if expected_total.is_none() {
                    if let Some(header_end) = buffer.windows(4).position(|item| item == b"\r\n\r\n")
                    {
                        let header_bytes = &buffer[..header_end + 4];
                        let header_text = String::from_utf8_lossy(header_bytes);
                        let content_length = header_text
                            .lines()
                            .find_map(|line| {
                                let lower = line.to_ascii_lowercase();
                                lower
                                    .strip_prefix("content-length:")
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        expected_total = Some(header_end + 4 + content_length);
                    }
                }
                if let Some(expected_total) = expected_total {
                    if buffer.len() >= expected_total {
                        break;
                    }
                }
            }
            let request = String::from_utf8_lossy(&buffer).to_string();
            let (status_code, body) = handler(request);
            let response = format!(
                "HTTP/1.1 {status_code} TEST\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });
        (port, handle)
    }

    fn spawn_sleeping_child() -> Child {
        Command::new("/bin/sh")
            .arg("-lc")
            .arg("sleep 30")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn sleeping child")
    }

    fn insert_chromium_session(manager: &mut EngineManager, profile_id: &str, magic_port: u16) {
        let child = spawn_sleeping_child();
        let session = EngineSession {
            profile_id: profile_id.to_string(),
            session_id: 1,
            pid: Some(child.id()),
            started_at: now_ts(),
            debug_port: Some(19222),
            magic_port: Some(magic_port),
        };
        manager.sessions.insert(
            profile_id.to_string(),
            SessionRecord {
                session,
                profile_name: profile_id.to_string(),
                process: EngineProcess::Chromium {
                    child,
                    debug_port: 19222,
                    magic_port,
                },
                launch_args: Vec::new(),
                extra_args: Vec::new(),
                windows: build_default_windows(Vec::new()),
                next_window_id: 2,
                next_tab_id: 2,
            },
        );
    }

    #[test]
    fn mock_mode_open_close_works() {
        let mut manager = EngineManager::new();

        let session = manager.open_profile("pf_000001").expect("open profile");
        assert_eq!(session.profile_id, "pf_000001");
        assert!(manager.is_running("pf_000001"));

        let close = manager.close_profile("pf_000001").expect("close profile");
        assert_eq!(close.profile_id, "pf_000001");
        assert!(!manager.is_running("pf_000001"));
    }

    #[test]
    fn tab_and_window_operations_work() {
        let mut manager = EngineManager::new();
        manager
            .open_profile_with_options(
                "pf_000001",
                &EngineLaunchOptions {
                    startup_urls: vec!["https://example.com".to_string()],
                    ..Default::default()
                },
            )
            .expect("open profile");

        let state_after_tab = manager
            .open_tab("pf_000001", Some("https://www.rust-lang.org".to_string()))
            .expect("open tab");
        assert_eq!(state_after_tab.total_tabs, 2);

        let state_after_window = manager
            .open_window("pf_000001", Some("https://tauri.app".to_string()))
            .expect("open window");
        assert_eq!(state_after_window.total_windows, 2);

        let focused = manager
            .focus_window("pf_000001", Some(1))
            .expect("focus first window");
        assert!(focused
            .windows
            .iter()
            .any(|item| item.window_id == 1 && item.focused));

        let closed_tab = manager
            .close_tab("pf_000001", None)
            .expect("close active tab");
        assert_eq!(closed_tab.total_tabs, 2);

        let activated = manager
            .activate_tab_by_index("pf_000001", 0, None)
            .expect("activate by index");
        assert!(activated
            .windows
            .iter()
            .any(|window| window.tabs.iter().any(|tab| tab.active)));

        let pruned = manager
            .close_inactive_tabs("pf_000001", None)
            .expect("close inactive tabs");
        assert!(pruned.total_tabs >= 1);
    }

    #[test]
    fn normalize_url_requires_valid_http_or_https() {
        let valid = normalize_url(Some(" https://example.com/path?q=1 ".to_string()))
            .expect("valid https url");
        assert!(valid.starts_with("https://example.com/path"));

        let invalid_scheme = normalize_url(Some("ftp://example.com".to_string()))
            .expect_err("ftp should be rejected");
        assert!(invalid_scheme
            .to_string()
            .contains("url must start with http:// or https://"));

        let invalid_url =
            normalize_url(Some("https://".to_string())).expect_err("empty host should be rejected");
        assert!(invalid_url
            .to_string()
            .contains("url is not a valid http/https URL"));
    }

    #[test]
    fn build_chromium_launch_args_adds_custom_bg_color_when_configured() {
        let options = EngineLaunchOptions {
            background_color: Some(" #0f8a73 ".to_string()),
            ..Default::default()
        };
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(
            args.iter().any(|arg| arg == "--custom-bg-color=#0F8A73"),
            "expected --custom-bg-color in args: {args:?}"
        );
    }

    #[test]
    fn build_chromium_launch_args_skips_custom_bg_color_when_not_set() {
        let options = EngineLaunchOptions::default();
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(
            !args.iter().any(|arg| arg.starts_with("--custom-bg-color=")),
            "custom-bg-color should be absent when not configured: {args:?}"
        );
    }

    #[test]
    fn build_chromium_launch_args_enables_chromium_stderr_logging() {
        let options = EngineLaunchOptions {
            logging_enabled: true,
            ..Default::default()
        };
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(
            args.iter().any(|arg| arg == "--enable-logging=stderr"),
            "expected chromium stderr logging flag in args: {args:?}"
        );
        assert!(
            args.iter().any(|arg| arg == "--v=1"),
            "expected chromium verbose logging level in args: {args:?}"
        );
    }

    #[test]
    fn build_chromium_launch_args_never_adds_geoip_database_flag() {
        let options = EngineLaunchOptions::default();
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(
            !args.iter().any(|arg| arg.starts_with("--geoip-database=")),
            "geoip-database should be absent from chromium args: {args:?}"
        );
    }

    #[test]
    fn build_chromium_launch_args_adds_cookie_state_file_when_configured() {
        let options = EngineLaunchOptions {
            cookie_state_file: Some(PathBuf::from(
                "/tmp/multi-flow-tests/runtime/cookie-state.json",
            )),
            ..Default::default()
        };
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(args.iter().any(|arg| {
            arg == "--cookie-state-file=/tmp/multi-flow-tests/runtime/cookie-state.json"
        }));
    }

    #[test]
    fn build_chromium_launch_args_adds_extension_state_file_when_configured() {
        let options = EngineLaunchOptions {
            extension_state_file: Some(PathBuf::from(
                "/tmp/multi-flow-tests/runtime/extension-state.json",
            )),
            ..Default::default()
        };
        let args = build_chromium_launch_args(
            &PathBuf::from("/tmp/multi-flow-tests/user-data"),
            &PathBuf::from("/tmp/multi-flow-tests/cache-data"),
            19222,
            19322,
            &options,
        )
        .expect("build args");

        assert!(args.iter().any(|arg| {
            arg == "--extension-state-file=/tmp/multi-flow-tests/runtime/extension-state.json"
        }));
    }

    #[test]
    fn close_profile_requests_safe_quit_before_process_cleanup() {
        let commands = Arc::new(Mutex::new(Vec::<String>::new()));
        let commands_clone = Arc::clone(&commands);
        let (magic_port, server) = spawn_magic_test_server(move |request| {
            commands_clone.lock().expect("commands lock").push(request);
            (200, r#"{"status":"ok"}"#.to_string())
        });
        let mut manager = EngineManager::new();
        insert_chromium_session(&mut manager, "pf_safe_quit", magic_port);

        let closed = manager
            .close_profile("pf_safe_quit")
            .expect("close chromium profile");
        assert_eq!(closed.profile_id, "pf_safe_quit");

        server.join().expect("join test magic server");
        let requests = commands.lock().expect("commands lock");
        assert_eq!(requests.len(), 1, "expected one magic request");
        assert!(
            requests[0].contains("\"cmd\":\"safe_quit\""),
            "expected safe_quit request, got: {}",
            requests[0]
        );
    }

    #[test]
    fn close_profile_waits_for_safe_quit_timeout_before_force_kill() {
        let (magic_port, server) =
            spawn_magic_test_server(|_| (200, r#"{"status":"ok"}"#.to_string()));
        let mut manager = EngineManager::new();
        insert_chromium_session(&mut manager, "pf_timeout", magic_port);

        let started_at = Instant::now();
        manager
            .close_profile("pf_timeout")
            .expect("close chromium profile");
        let elapsed = started_at.elapsed();

        server.join().expect("join test magic server");
        assert!(
            elapsed >= Duration::from_millis(2800),
            "expected safe_quit timeout wait before force kill, elapsed={elapsed:?}"
        );
    }

    #[test]
    fn close_profile_falls_back_to_force_kill_when_safe_quit_rejected() {
        let commands = Arc::new(Mutex::new(Vec::<String>::new()));
        let commands_clone = Arc::clone(&commands);
        let (magic_port, server) = spawn_magic_test_server(move |request| {
            commands_clone.lock().expect("commands lock").push(request);
            (500, r#"{"status":"error","message":"boom"}"#.to_string())
        });
        let mut manager = EngineManager::new();
        insert_chromium_session(&mut manager, "pf_fallback", magic_port);

        let started_at = Instant::now();
        manager
            .close_profile("pf_fallback")
            .expect("close chromium profile");
        let elapsed = started_at.elapsed();

        server.join().expect("join test magic server");
        let requests = commands.lock().expect("commands lock");
        assert_eq!(requests.len(), 1, "expected one magic request");
        assert!(
            requests[0].contains("\"cmd\":\"safe_quit\""),
            "expected safe_quit request, got: {}",
            requests[0]
        );
        assert!(
            elapsed < Duration::from_secs(2),
            "expected immediate force kill fallback, elapsed={elapsed:?}"
        );
    }
}
