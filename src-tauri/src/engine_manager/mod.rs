use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{
    now_ts, EngineSession, ProfileWindow, ProfileWindowState, WindowBounds, WindowTab,
};
use serde_json::{json, Value};

const DEFAULT_TAB_URL: &str = "https://www.browserscan.net/";
const MAGIC_HTTP_REQUEST_TIMEOUT_SECS: u64 = 2;
const MAGIC_HTTP_MAX_RETRIES: usize = 8;
const MAGIC_HTTP_RETRY_DELAY_MS: u64 = 120;
const MAGIC_HTTP_PATHS: [&str; 4] = ["/", "/cmd", "/command", "/magic"];

struct SessionRecord {
    session: EngineSession,
    process: EngineProcess,
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
}

#[derive(Debug, Clone, Default)]
pub struct EngineLaunchOptions {
    pub user_agent: Option<String>,
    pub language: Option<String>,
    pub timezone_id: Option<String>,
    pub startup_url: Option<String>,
    pub proxy_server: Option<String>,
    pub web_rtc_policy: Option<String>,
    pub geoip_database_path: Option<PathBuf>,
    pub headless: bool,
    pub disable_images: bool,
    pub toolbar_text: Option<String>,
    pub background_color: Option<String>,
    pub custom_cpu_cores: Option<u32>,
    pub custom_ram_gb: Option<u32>,
    pub custom_font_list: Option<Vec<String>>,
    pub extra_args: Vec<String>,
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
        logger::info(
            "engine_manager",
            format!("open_profile start profile_id={profile_id} options={options:?}"),
        );
        if self.sessions.contains_key(profile_id) {
            logger::warn(
                "engine_manager",
                format!("open_profile rejected, profile already running: {profile_id}"),
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
            EngineProcess::Mock
        };
        let pid = match &process {
            EngineProcess::Chromium { child, .. } => Some(child.id()),
            EngineProcess::Mock => None,
        };
        let session = EngineSession {
            profile_id: profile_id.to_string(),
            session_id,
            pid,
            started_at: now_ts(),
        };
        self.sessions.insert(
            profile_id.to_string(),
            SessionRecord {
                session: session.clone(),
                process,
                windows: build_default_windows(options.startup_url.clone()),
                next_window_id: 2,
                next_tab_id: 2,
            },
        );
        logger::info(
            "engine_manager",
            format!(
                "open_profile success profile_id={profile_id} session_id={} pid={:?}",
                session.session_id, session.pid
            ),
        );

        Ok(session)
    }

    pub fn close_profile(&mut self, profile_id: &str) -> AppResult<EngineSession> {
        logger::info(
            "engine_manager",
            format!("close_profile start profile_id={profile_id}"),
        );
        let mut record = self.sessions.remove(profile_id).ok_or_else(|| {
            AppError::NotFound(format!("running session not found: {profile_id}"))
        })?;

        if let EngineProcess::Chromium {
            child,
            debug_port,
            magic_port,
        } = &mut record.process
        {
            let _ = try_magic_close(profile_id, *magic_port);
            logger::info(
                "engine_manager",
                format!(
                    "close_profile terminating chromium profile_id={profile_id} pid={} debug_port={} magic_port={}",
                    child.id(),
                    debug_port,
                    magic_port
                ),
            );
            let _ = child.kill();
            let _ = child.wait();
        }
        logger::info(
            "engine_manager",
            format!(
                "close_profile success profile_id={profile_id} session_id={} pid={:?}",
                record.session.session_id, record.session.pid
            ),
        );

        Ok(record.session)
    }

    pub fn is_running(&self, profile_id: &str) -> bool {
        self.sessions.contains_key(profile_id)
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
            EngineProcess::Chromium { magic_port, .. } => Ok(Some(*magic_port)),
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
                        "command success profile_id={profile_id} cmd={cmd} path={path} payload={payload_string}"
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

    fn spawn_chromium_if_configured(
        &mut self,
        profile_id: &str,
        options: &EngineLaunchOptions,
    ) -> AppResult<Option<EngineProcess>> {
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

        let mut args = vec![
            format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
            format!("--disk-cache-dir={}", cache_data_dir.to_string_lossy()),
            format!("--remote-debugging-port={debug_port}"),
            format!("--magic-socket-server-port={magic_port}"),
            "--no-first-run".to_string(),
            "--no-default-browser-check".to_string(),
        ];
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
        if let Some(geoip_path) = options.geoip_database_path.as_ref() {
            if geoip_path.is_file() {
                args.push(format!("--geoip-database={}", geoip_path.to_string_lossy()));
            }
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
        for extra in &options.extra_args {
            if let Some(arg) = trim_to_option(extra) {
                args.push(arg);
            }
        }
        if let Some(startup_url) = options
            .startup_url
            .as_ref()
            .and_then(|value| trim_to_option(value))
        {
            args.push(startup_url);
        }

        let timezone = options
            .timezone_id
            .as_ref()
            .and_then(|value| trim_to_option(value));
        logger::info(
            "engine_manager.launch",
            format!(
                "spawn chromium profile_id={profile_id} executable={} args={:?} env_TZ={:?} magic_port={magic_port}",
                executable.to_string_lossy(),
                args,
                timezone
            ),
        );
        let mut command = Command::new(executable);
        command
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        if let Some(timezone_id) = timezone {
            command.env("TZ", timezone_id);
        }
        let child = command.spawn().map_err(|err| {
            logger::error(
                "engine_manager.launch",
                format!("spawn chromium failed profile_id={profile_id}: {err}"),
            );
            AppError::Io(err)
        })?;
        logger::info(
            "engine_manager.launch",
            format!(
                "spawn chromium success profile_id={profile_id} pid={} debug_port={debug_port} magic_port={magic_port}",
                child.id()
            ),
        );

        Ok(Some(EngineProcess::Chromium {
            child,
            debug_port,
            magic_port,
        }))
    }

    fn session_record_mut(&mut self, profile_id: &str) -> AppResult<&mut SessionRecord> {
        self.sessions
            .get_mut(profile_id)
            .ok_or_else(|| AppError::NotFound(format!("running session not found: {profile_id}")))
    }
}

struct MagicHttpResponse {
    status_code: u16,
    body: String,
}

fn send_magic_http_request(port: u16, path: &str, payload: &Value) -> AppResult<MagicHttpResponse> {
    let url = format!("http://127.0.0.1:{port}{path}");
    let request_payload = payload.clone();
    tauri::async_runtime::block_on(async move {
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

fn try_magic_close(profile_id: &str, port: u16) -> AppResult<()> {
    let payload = json!({ "cmd": "set_closed" });
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
                "magic close response parse failed profile_id={profile_id} path={path}: {err}"
            ))
        })?;
        if parsed.get("status").and_then(Value::as_str) == Some("ok") {
            logger::info(
                "engine_manager.magic",
                format!("magic close success profile_id={profile_id} path={path}"),
            );
            return Ok(());
        }
    }
    Ok(())
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

fn build_default_windows(startup_url: Option<String>) -> Vec<WindowRecord> {
    let url = normalize_url(startup_url).unwrap_or_else(|_| DEFAULT_TAB_URL.to_string());
    vec![WindowRecord {
        window_id: 1,
        focused: true,
        bounds: None,
        tabs: vec![TabRecord {
            tab_id: 1,
            title: derive_tab_title(&url),
            url,
            active: true,
        }],
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
                    startup_url: Some("https://example.com".to_string()),
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
}
