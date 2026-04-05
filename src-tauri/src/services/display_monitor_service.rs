#[cfg(all(target_family = "unix", not(target_os = "macos")))]
use std::fs;
use std::process::Command;

use display_info::DisplayInfo;
use serde::Deserialize;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{DisplayMonitorItem, WindowBounds};

#[derive(Debug, Clone)]
struct BaseMonitorSnapshot {
    id: String,
    name: Option<String>,
    is_primary: bool,
    scale_factor: f64,
    position_x: i32,
    position_y: i32,
    width: u32,
    height: u32,
    work_area: WindowBounds,
}

#[derive(Debug, Clone, PartialEq)]
struct DisplayMetadata {
    position_x: i32,
    position_y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
    is_builtin: bool,
    friendly_name: Option<String>,
    manufacturer: Option<String>,
    model: Option<String>,
}

pub fn collect_display_monitors(app: &AppHandle) -> AppResult<Vec<DisplayMonitorItem>> {
    let base_monitors = collect_base_monitors(app)?;
    let metadata = collect_display_metadata();
    let host_device_name = resolve_host_device_name();

    Ok(base_monitors
        .into_iter()
        .enumerate()
        .map(|(index, base)| {
            let matched = find_unique_metadata(&base, &metadata);
            build_display_monitor_item(base, matched, host_device_name.as_deref(), index)
        })
        .collect())
}

fn collect_base_monitors(app: &AppHandle) -> AppResult<Vec<BaseMonitorSnapshot>> {
    let primary_key = app
        .primary_monitor()
        .map_err(|err| AppError::Validation(format!("read primary monitor failed: {err}")))?
        .map(|monitor| monitor_key(&monitor))
        .unwrap_or_default();
    let monitors = app
        .available_monitors()
        .map_err(|err| AppError::Validation(format!("list monitors failed: {err}")))?;

    Ok(monitors
        .into_iter()
        .map(|monitor| {
            let key = monitor_key(&monitor);
            let work_area = monitor.work_area();

            BaseMonitorSnapshot {
                id: key.clone(),
                name: clean_display_text(monitor.name().map(String::as_str)),
                is_primary: key == primary_key,
                scale_factor: monitor.scale_factor(),
                position_x: monitor.position().x,
                position_y: monitor.position().y,
                width: monitor.size().width,
                height: monitor.size().height,
                work_area: WindowBounds {
                    x: work_area.position.x,
                    y: work_area.position.y,
                    width: i32::try_from(work_area.size.width).unwrap_or(i32::MAX),
                    height: i32::try_from(work_area.size.height).unwrap_or(i32::MAX),
                },
            }
        })
        .collect())
}

fn collect_display_metadata() -> Vec<DisplayMetadata> {
    match DisplayInfo::all() {
        Ok(displays) => displays.into_iter().map(DisplayMetadata::from).collect(),
        Err(err) => {
            logger::warn(
                "display_monitor_service",
                format!("collect display metadata failed: {err}"),
            );
            Vec::new()
        }
    }
}

fn find_unique_metadata<'a>(
    monitor: &BaseMonitorSnapshot,
    metadata: &'a [DisplayMetadata],
) -> Option<&'a DisplayMetadata> {
    let mut matches = metadata
        .iter()
        .filter(|item| monitor_matches_metadata(monitor, item));

    let first = matches.next()?;
    if matches.next().is_some() {
        return None;
    }
    Some(first)
}

fn monitor_matches_metadata(monitor: &BaseMonitorSnapshot, metadata: &DisplayMetadata) -> bool {
    let raw = (
        metadata.position_x,
        metadata.position_y,
        metadata.width,
        metadata.height,
    );
    let scaled = (
        scale_i32(metadata.position_x, metadata.scale_factor),
        scale_i32(metadata.position_y, metadata.scale_factor),
        scale_u32(metadata.width, metadata.scale_factor),
        scale_u32(metadata.height, metadata.scale_factor),
    );

    matches_monitor_geometry(monitor, raw) || matches_monitor_geometry(monitor, scaled)
}

fn matches_monitor_geometry(monitor: &BaseMonitorSnapshot, geometry: (i32, i32, u32, u32)) -> bool {
    let (position_x, position_y, width, height) = geometry;
    position_x == monitor.position_x
        && position_y == monitor.position_y
        && width == monitor.width
        && height == monitor.height
}

fn scale_i32(value: i32, scale_factor: f64) -> i32 {
    ((value as f64) * scale_factor).round() as i32
}

fn scale_u32(value: u32, scale_factor: f64) -> u32 {
    ((value as f64) * scale_factor).round() as u32
}

fn build_display_monitor_item(
    base: BaseMonitorSnapshot,
    metadata: Option<&DisplayMetadata>,
    host_device_name: Option<&str>,
    fallback_index: usize,
) -> DisplayMonitorItem {
    let friendly_name = metadata.and_then(|item| item.friendly_name.clone());
    let manufacturer = metadata.and_then(|item| item.manufacturer.clone());
    let model = metadata.and_then(|item| item.model.clone());
    let is_builtin = metadata.map(|item| item.is_builtin).unwrap_or(false);
    let host_device_name = if is_builtin {
        clean_display_text(host_device_name)
    } else {
        None
    };

    let name = resolve_legacy_name(
        base.name.as_deref(),
        friendly_name.as_deref(),
        manufacturer.as_deref(),
        model.as_deref(),
        is_builtin,
        host_device_name.as_deref(),
        fallback_index,
    );

    DisplayMonitorItem {
        id: base.id,
        name,
        is_primary: base.is_primary,
        is_builtin,
        friendly_name,
        manufacturer,
        model,
        host_device_name,
        scale_factor: base.scale_factor,
        position_x: base.position_x,
        position_y: base.position_y,
        width: base.width,
        height: base.height,
        work_area: base.work_area,
    }
}

fn resolve_legacy_name(
    base_name: Option<&str>,
    friendly_name: Option<&str>,
    manufacturer: Option<&str>,
    model: Option<&str>,
    is_builtin: bool,
    host_device_name: Option<&str>,
    fallback_index: usize,
) -> String {
    if let Some(name) = friendly_name.and_then(|value| clean_display_text(Some(value))) {
        return name;
    }

    if let Some(identity) = join_display_identity(manufacturer, model) {
        return identity;
    }

    if let Some(name) = clean_display_text(base_name) {
        return name;
    }

    if is_builtin {
        if let Some(host) = clean_display_text(host_device_name) {
            return format!("{host} Built-in Display");
        }
        return "Built-in Display".to_string();
    }

    format!("Display {}", fallback_index + 1)
}

fn join_display_identity(manufacturer: Option<&str>, model: Option<&str>) -> Option<String> {
    let manufacturer = clean_display_text(manufacturer);
    let model = clean_display_text(model);
    match (manufacturer, model) {
        (Some(manufacturer), Some(model)) if manufacturer.eq_ignore_ascii_case(&model) => {
            Some(manufacturer)
        }
        (Some(manufacturer), Some(model)) => Some(format!("{manufacturer} {model}")),
        (Some(manufacturer), None) => Some(manufacturer),
        (None, Some(model)) => Some(model),
        (None, None) => None,
    }
}

fn clean_display_text(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }

    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let lowercase = normalized.to_ascii_lowercase();
    if lowercase == "unknown"
        || lowercase == "unknown display"
        || lowercase.starts_with("unknown display ")
        || lowercase.starts_with(r"\\.\display")
        || lowercase.starts_with("monitor #")
        || is_generic_display_name(&lowercase)
    {
        return None;
    }

    Some(normalized)
}

fn is_generic_display_name(lowercase: &str) -> bool {
    let Some(rest) = lowercase.strip_prefix("display ") else {
        return false;
    };
    !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit())
}

impl From<DisplayInfo> for DisplayMetadata {
    fn from(display: DisplayInfo) -> Self {
        let friendly_name = clean_display_text(Some(display.friendly_name.as_str()));
        let (manufacturer, model) = infer_manufacturer_and_model(friendly_name.as_deref());

        Self {
            position_x: display.x,
            position_y: display.y,
            width: display.width,
            height: display.height,
            scale_factor: f64::from(display.scale_factor),
            is_builtin: display.is_builtin,
            friendly_name,
            manufacturer,
            model,
        }
    }
}

fn infer_manufacturer_and_model(label: Option<&str>) -> (Option<String>, Option<String>) {
    let Some(label) = label else {
        return (None, None);
    };
    let normalized = label.trim();
    if normalized.is_empty() || normalized.to_ascii_lowercase().contains("built-in") {
        return (None, None);
    }

    let mut parts = normalized.split_whitespace();
    let Some(first) = parts.next() else {
        return (None, None);
    };
    let rest = parts.collect::<Vec<_>>().join(" ");
    if rest.is_empty() {
        return (None, None);
    }

    (Some(first.to_string()), Some(rest))
}

#[cfg(target_os = "macos")]
fn resolve_host_device_name() -> Option<String> {
    #[derive(Debug, Deserialize)]
    struct HardwareEntry {
        machine_name: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct HardwareResponse {
        #[serde(rename = "SPHardwareDataType")]
        hardware_data: Vec<HardwareEntry>,
    }

    let output = Command::new("system_profiler")
        .args(["SPHardwareDataType", "-json"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let response: HardwareResponse = serde_json::from_slice(&output.stdout).ok()?;
    response
        .hardware_data
        .into_iter()
        .find_map(|item| clean_display_text(item.machine_name.as_deref()))
}

#[cfg(target_os = "windows")]
fn resolve_host_device_name() -> Option<String> {
    #[derive(Debug, Deserialize)]
    struct ComputerSystemResponse {
        #[serde(rename = "Manufacturer")]
        manufacturer: Option<String>,
        #[serde(rename = "Model")]
        model: Option<String>,
    }

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_ComputerSystem | Select-Object -First 1 Manufacturer,Model | ConvertTo-Json -Compress",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let response: ComputerSystemResponse = serde_json::from_slice(&output.stdout).ok()?;
    join_display_identity(response.manufacturer.as_deref(), response.model.as_deref())
}

#[cfg(all(target_family = "unix", not(target_os = "macos")))]
fn resolve_host_device_name() -> Option<String> {
    let manufacturer = read_linux_dmi_field(&[
        "/sys/devices/virtual/dmi/id/sys_vendor",
        "/sys/class/dmi/id/sys_vendor",
    ]);
    let model = read_linux_dmi_field(&[
        "/sys/devices/virtual/dmi/id/product_name",
        "/sys/class/dmi/id/product_name",
    ]);

    join_display_identity(manufacturer.as_deref(), model.as_deref())
}

#[cfg(all(target_family = "unix", not(target_os = "macos")))]
fn read_linux_dmi_field(paths: &[&str]) -> Option<String> {
    paths.iter().find_map(|path| {
        fs::read_to_string(path)
            .ok()
            .and_then(|value| clean_display_text(Some(value.as_str())))
    })
}

fn monitor_key(monitor: &tauri::Monitor) -> String {
    format!(
        "{}:{}:{}:{}",
        monitor.name().cloned().unwrap_or_default(),
        monitor.position().x,
        monitor.position().y,
        monitor.scale_factor()
    )
}

#[cfg(test)]
mod tests {
    use super::{
        build_display_monitor_item, find_unique_metadata, BaseMonitorSnapshot, DisplayMetadata,
    };
    use crate::models::WindowBounds;

    fn base_monitor(name: Option<&str>) -> BaseMonitorSnapshot {
        BaseMonitorSnapshot {
            id: "display-1".to_string(),
            name: name.map(ToString::to_string),
            is_primary: false,
            scale_factor: 2.0,
            position_x: 0,
            position_y: 0,
            width: 3024,
            height: 1964,
            work_area: WindowBounds {
                x: 0,
                y: 0,
                width: 1512,
                height: 944,
            },
        }
    }

    fn metadata() -> DisplayMetadata {
        DisplayMetadata {
            position_x: 0,
            position_y: 0,
            width: 3024,
            height: 1964,
            scale_factor: 1.0,
            is_builtin: false,
            friendly_name: Some("Dell U2720Q".to_string()),
            manufacturer: Some("Dell".to_string()),
            model: Some("U2720Q".to_string()),
        }
    }

    #[test]
    fn build_display_monitor_item_prefers_friendly_name_for_external_display() {
        let item = build_display_monitor_item(
            base_monitor(Some("DP-1")),
            Some(&metadata()),
            Some("MacBook Pro"),
            0,
        );

        assert_eq!(item.name, "Dell U2720Q");
        assert_eq!(item.friendly_name.as_deref(), Some("Dell U2720Q"));
        assert_eq!(item.manufacturer.as_deref(), Some("Dell"));
        assert_eq!(item.model.as_deref(), Some("U2720Q"));
        assert_eq!(item.host_device_name, None);
        assert!(!item.is_builtin);
    }

    #[test]
    fn build_display_monitor_item_prefers_host_device_for_builtin_display() {
        let mut builtin = metadata();
        builtin.is_builtin = true;
        builtin.friendly_name = Some("Built-in Retina Display".to_string());
        builtin.manufacturer = None;
        builtin.model = None;

        let item = build_display_monitor_item(
            base_monitor(Some("Color LCD")),
            Some(&builtin),
            Some("MacBook Pro"),
            0,
        );

        assert_eq!(item.host_device_name.as_deref(), Some("MacBook Pro"));
        assert_eq!(
            item.friendly_name.as_deref(),
            Some("Built-in Retina Display")
        );
        assert!(item.is_builtin);
    }

    #[test]
    fn build_display_monitor_item_uses_identity_before_legacy_name() {
        let mut item_metadata = metadata();
        item_metadata.friendly_name = None;

        let item =
            build_display_monitor_item(base_monitor(Some("DP-1")), Some(&item_metadata), None, 0);

        assert_eq!(item.name, "Dell U2720Q");
    }

    #[test]
    fn find_unique_metadata_returns_match_for_unique_geometry() {
        let item_metadata = metadata();
        let candidates = [item_metadata.clone()];

        let matched = find_unique_metadata(&base_monitor(Some("DP-1")), &candidates);

        assert_eq!(matched, Some(&item_metadata));
    }

    #[test]
    fn find_unique_metadata_returns_none_for_ambiguous_geometry() {
        let item_metadata = metadata();
        let duplicated = metadata();
        let candidates = [item_metadata, duplicated];

        let matched = find_unique_metadata(&base_monitor(Some("DP-1")), &candidates);

        assert_eq!(matched, None);
    }

    #[test]
    fn find_unique_metadata_returns_none_when_geometry_is_missing() {
        let mut item_metadata = metadata();
        item_metadata.position_x = 100;
        let candidates = [item_metadata];

        let matched = find_unique_metadata(&base_monitor(Some("DP-1")), &candidates);

        assert_eq!(matched, None);
    }

    #[test]
    fn find_unique_metadata_accepts_scaled_geometry_match() {
        let mut item_metadata = metadata();
        item_metadata.position_x = -2144;
        item_metadata.position_y = 277;
        item_metadata.width = 2560;
        item_metadata.height = 1440;
        item_metadata.scale_factor = 2.0;

        let mut base = base_monitor(Some("Monitor #23784"));
        base.position_x = -4288;
        base.position_y = 554;
        base.width = 5120;
        base.height = 2880;

        let candidates = [item_metadata.clone()];
        let matched = find_unique_metadata(&base, &candidates);

        assert_eq!(matched, Some(&item_metadata));
    }
}
