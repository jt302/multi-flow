use crate::chromium_version_catalog::{self, ChromiumVersionEntry};

#[tauri::command]
pub fn list_chromium_versions_for_platform(platform: String) -> Vec<ChromiumVersionEntry> {
    chromium_version_catalog::versions_for(&platform).to_vec()
}

#[tauri::command]
pub fn latest_chromium_version_for_platform(platform: String) -> String {
    chromium_version_catalog::latest_for(&platform).version.to_string()
}
