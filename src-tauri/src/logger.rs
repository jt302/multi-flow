use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::AppHandle;
use tauri::Emitter;

use crate::state::resolve_app_data_dir;

static LOG_FILE: OnceLock<Mutex<std::fs::File>> = OnceLock::new();
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub const BACKEND_LOG_EVENT: &str = "backend_log_event";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendLogEvent {
    pub ts: i64,
    pub level: String,
    pub component: String,
    pub message: String,
    pub profile_id: Option<String>,
    pub profile_name: Option<String>,
    pub line: String,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let data_dir = resolve_app_data_dir(app).map_err(|err| err.to_string())?;
    let log_dir = data_dir.join("logs");
    fs::create_dir_all(&log_dir).map_err(|err| format!("create log dir failed: {err}"))?;
    let log_path = log_dir.join("backend.log");
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|err| format!("open log file failed: {err}"))?;

    let _ = LOG_FILE.set(Mutex::new(file));
    let _ = LOG_PATH.set(log_path.clone());
    let _ = APP_HANDLE.set(app.clone());
    info(
        "logger",
        format!("initialized log file at {}", log_path.to_string_lossy()),
    );
    Ok(())
}

pub fn info(component: &str, message: impl AsRef<str>) {
    write_line("INFO", component, message.as_ref());
}

pub fn warn(component: &str, message: impl AsRef<str>) {
    write_line("WARN", component, message.as_ref());
}

pub fn error(component: &str, message: impl AsRef<str>) {
    write_line("ERROR", component, message.as_ref());
}

pub fn read_recent_events(limit: usize) -> Result<Vec<BackendLogEvent>, String> {
    if limit == 0 {
        return Ok(Vec::new());
    }
    let Some(path) = LOG_PATH.get() else {
        return Ok(Vec::new());
    };
    if !path.is_file() {
        return Ok(Vec::new());
    }

    let raw = fs::read(path).map_err(|err| format!("read log file failed: {err}"))?;
    let content = String::from_utf8_lossy(&raw);
    let mut events = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(parse_line_to_event)
        .collect::<Vec<_>>();
    if events.len() > limit {
        let start = events.len().saturating_sub(limit);
        events = events.split_off(start);
    }
    Ok(events)
}

fn write_line(level: &str, component: &str, message: &str) {
    let ts = now_ts();
    let line = format!("[{}][{}][{}] {}", ts, level, component, message);
    let event = BackendLogEvent {
        ts,
        level: level.to_string(),
        component: component.to_string(),
        message: message.to_string(),
        profile_id: extract_profile_id(message),
        profile_name: extract_profile_name(message),
        line: line.clone(),
    };

    println!("{line}");
    if let Some(file) = LOG_FILE.get() {
        if let Ok(mut handle) = file.lock() {
            let _ = writeln!(handle, "{line}");
            let _ = handle.flush();
        }
    }
    if let Some(app) = APP_HANDLE.get() {
        let _ = app.emit(BACKEND_LOG_EVENT, event);
    }
}

fn parse_line_to_event(line: &str) -> BackendLogEvent {
    let trimmed = line.trim();
    if let Some((ts, level, component, message)) = parse_line_parts(trimmed) {
        return BackendLogEvent {
            ts,
            level: level.to_string(),
            component: component.to_string(),
            message: message.to_string(),
            profile_id: extract_profile_id(message),
            profile_name: extract_profile_name(message),
            line: trimmed.to_string(),
        };
    }

    BackendLogEvent {
        ts: now_ts(),
        level: "INFO".to_string(),
        component: "logger".to_string(),
        message: trimmed.to_string(),
        profile_id: extract_profile_id(trimmed),
        profile_name: extract_profile_name(trimmed),
        line: trimmed.to_string(),
    }
}

fn parse_line_parts(line: &str) -> Option<(i64, &str, &str, &str)> {
    let (ts_part, rest) = split_bracketed(line)?;
    let (level_part, rest) = split_bracketed(rest.trim_start())?;
    let (component_part, message) = split_bracketed(rest.trim_start())?;
    let ts = ts_part.parse::<i64>().ok()?;
    Some((ts, level_part, component_part, message.trim_start()))
}

fn split_bracketed(input: &str) -> Option<(&str, &str)> {
    let payload = input.strip_prefix('[')?;
    let end = payload.find(']')?;
    let value = &payload[..end];
    let rest = &payload[end + 1..];
    Some((value, rest))
}

fn extract_profile_id(message: &str) -> Option<String> {
    const PREFIX: &str = "profile_id=";
    let start = message.find(PREFIX)?;
    let raw = &message[start + PREFIX.len()..];
    let value = raw
        .chars()
        .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '_' || *ch == '-')
        .collect::<String>();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_profile_name(message: &str) -> Option<String> {
    const PREFIX: &str = "profile_name=\"";
    let start = message.find(PREFIX)?;
    let raw = &message[start + PREFIX.len()..];
    let end = raw.find('"')?;
    let value = raw[..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{extract_profile_id, extract_profile_name, parse_line_to_event};

    #[test]
    fn parse_line_extracts_profile_name_and_id() {
        let event = parse_line_to_event(
            r#"[1762932800][INFO][chromium.stderr] profile_id=pf_000011 profile_name="Mac 1" hello"#,
        );

        assert_eq!(event.profile_id.as_deref(), Some("pf_000011"));
        assert_eq!(event.profile_name.as_deref(), Some("Mac 1"));
    }

    #[test]
    fn extract_profile_name_handles_missing_value() {
        assert_eq!(extract_profile_name("hello"), None);
        assert_eq!(extract_profile_id("hello"), None);
    }
}
