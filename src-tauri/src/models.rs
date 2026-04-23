use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::services::app_preference_service::AiProviderConfig;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProfileLifecycle {
    Active,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub numeric_id: i64,
    pub name: String,
    pub group: Option<String>,
    pub note: Option<String>,
    pub settings: Option<ProfileSettings>,
    pub resolved_toolbar_text: Option<String>,
    pub resolved_browser_bg_color: Option<String>,
    pub lifecycle: ProfileLifecycle,
    pub running: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub last_opened_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileRequest {
    pub name: String,
    pub group: Option<String>,
    pub note: Option<String>,
    pub proxy_id: Option<String>,
    pub settings: Option<ProfileSettings>,
}

/// 语言/时区的设置模式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LocaleMode {
    /// 跟随 IP：有代理则跟代理出口 IP，无代理则跟本机 IP
    #[default]
    Auto,
    /// 手动设置：直接使用 fingerprint.language / timezone_id，不再 fallback
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSettings {
    pub basic: Option<ProfileBasicSettings>,
    pub fingerprint: Option<ProfileFingerprintSettings>,
    pub advanced: Option<ProfileAdvancedSettings>,
    pub locale_mode: Option<LocaleMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBasicSettings {
    pub browser_kind: Option<String>,
    pub browser_version: Option<String>,
    pub platform: Option<String>,
    pub device_preset_id: Option<String>,
    pub startup_urls: Option<Vec<String>>,
    /// 历史兼容字段，仅用于旧数据读取；保存时统一收口到 startup_urls。
    pub startup_url: Option<String>,
    pub browser_bg_color: Option<String>,
    pub browser_bg_color_mode: Option<BrowserBgColorMode>,
    pub toolbar_label_mode: Option<ToolbarLabelMode>,
    pub toolbar_text: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrowserBgColorMode {
    Inherit,
    Custom,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolbarLabelMode {
    IdOnly,
    GroupNameAndId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDevicePreset {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub platform_version: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub device_scale_factor: f32,
    pub touch_points: u32,
    pub custom_platform: String,
    pub arch: String,
    pub bitness: String,
    pub mobile: bool,
    pub form_factor: String,
    pub user_agent_template: String,
    pub custom_gl_vendor: String,
    pub custom_gl_renderer: String,
    pub custom_cpu_cores: u32,
    pub custom_ram_gb: u32,
    pub browser_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProfileDevicePresetRequest {
    pub label: String,
    pub platform: String,
    pub platform_version: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub device_scale_factor: f32,
    pub touch_points: u32,
    pub custom_platform: String,
    pub arch: String,
    pub bitness: String,
    pub mobile: bool,
    pub form_factor: String,
    pub user_agent_template: String,
    pub custom_gl_vendor: String,
    pub custom_gl_renderer: String,
    pub custom_cpu_cores: u32,
    pub custom_ram_gb: u32,
    pub browser_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDevicePresetOutcome {
    pub preset: ProfileDevicePreset,
    pub synced_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserAgentMode {
    Random,
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FingerprintStrategy {
    Template,
    RandomBundle,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FingerprintSeedPolicy {
    Fixed,
    PerLaunch,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum FontListMode {
    #[default]
    Preset,
    Random,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFingerprintSource {
    pub platform: Option<String>,
    pub device_preset_id: Option<String>,
    pub browser_version: Option<String>,
    pub strategy: Option<FingerprintStrategy>,
    pub seed_policy: Option<FingerprintSeedPolicy>,
    pub catalog_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFingerprintSnapshot {
    pub browser_version: Option<String>,
    pub platform: Option<String>,
    pub platform_version: Option<String>,
    pub preset_label: Option<String>,
    pub form_factor: Option<String>,
    pub mobile: Option<bool>,
    pub user_agent: Option<String>,
    pub custom_ua_metadata: Option<String>,
    pub custom_platform: Option<String>,
    pub custom_cpu_cores: Option<u32>,
    pub custom_ram_gb: Option<u32>,
    pub custom_gl_vendor: Option<String>,
    pub custom_gl_renderer: Option<String>,
    pub custom_touch_points: Option<u32>,
    pub custom_font_list: Option<Vec<String>>,
    pub language: Option<String>,
    pub accept_languages: Option<String>,
    pub time_zone: Option<String>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
    pub device_scale_factor: Option<f32>,
    pub fingerprint_seed: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFingerprintSettings {
    pub fingerprint_source: Option<ProfileFingerprintSource>,
    pub fingerprint_snapshot: Option<ProfileFingerprintSnapshot>,
    /// 历史兼容字段，仅用于旧数据懒迁移；新逻辑不再作为主写入来源。
    pub user_agent_mode: Option<UserAgentMode>,
    /// 历史兼容字段，仅用于旧数据懒迁移；运行时应优先读取 fingerprint_snapshot.user_agent。
    pub user_agent: Option<String>,
    pub language: Option<String>,
    pub timezone_id: Option<String>,
    pub font_list_mode: Option<FontListMode>,
    pub device_name_mode: Option<CustomValueMode>,
    pub custom_device_name: Option<String>,
    pub mac_address_mode: Option<CustomValueMode>,
    pub custom_mac_address: Option<String>,
    pub do_not_track_enabled: Option<bool>,
    pub web_rtc_mode: Option<WebRtcMode>,
    pub webrtc_ip_override: Option<String>,
    pub viewport_width: Option<u32>,
    pub viewport_height: Option<u32>,
    pub device_scale_factor: Option<f32>,
    /// 历史兼容字段，仅用于旧数据懒迁移；运行时应优先读取 fingerprint_snapshot.custom_cpu_cores。
    pub custom_cpu_cores: Option<u32>,
    /// 历史兼容字段，仅用于旧数据懒迁移；运行时应优先读取 fingerprint_snapshot.custom_ram_gb。
    pub custom_ram_gb: Option<u32>,
    /// 自定义字体列表。当 font_list_mode = custom 时，保存/预览/启动都会使用该列表。
    pub custom_font_list: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePluginSelection {
    pub package_id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAdvancedSettings {
    pub headless: Option<bool>,
    pub disable_images: Option<bool>,
    pub cookie_state_json: Option<String>,
    pub plugin_selections: Option<Vec<ProfilePluginSelection>>,
    pub geolocation_mode: Option<GeolocationMode>,
    pub auto_allow_geolocation: Option<bool>,
    pub geolocation: Option<GeolocationOverride>,
    pub custom_launch_args: Option<Vec<String>>,
    pub random_fingerprint: Option<bool>,
    pub fixed_fingerprint_seed: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProfileGroupLifecycle {
    Active,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileGroup {
    pub id: String,
    pub name: String,
    pub note: Option<String>,
    pub browser_bg_color: Option<String>,
    pub toolbar_label_mode: ToolbarLabelMode,
    pub lifecycle: ProfileGroupLifecycle,
    pub profile_count: usize,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileGroupRequest {
    pub name: String,
    pub note: Option<String>,
    pub browser_bg_color: Option<String>,
    pub toolbar_label_mode: Option<ToolbarLabelMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileGroupRequest {
    pub name: String,
    pub note: Option<String>,
    pub browser_bg_color: Option<String>,
    pub toolbar_label_mode: Option<ToolbarLabelMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProfileGroupsResponse {
    pub items: Vec<ProfileGroup>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProfilesResponse {
    pub items: Vec<Profile>,
    pub total: usize,
    pub page: u64,
    pub page_size: u64,
    pub total_pages: u64,
}

#[derive(Debug, Clone)]
pub struct ListProfilesQuery {
    pub include_deleted: bool,
    pub page: u64,
    pub page_size: u64,
    pub keyword: Option<String>,
    pub group: Option<String>,
    pub running: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSession {
    pub profile_id: String,
    pub session_id: u64,
    pub pid: Option<u32>,
    pub started_at: i64,
    pub debug_port: Option<u16>,
    pub magic_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineRuntimeHandle {
    pub profile_id: String,
    pub session_id: u64,
    pub pid: Option<u32>,
    pub debug_port: Option<u16>,
    pub magic_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRuntimeDetails {
    pub profile_id: String,
    pub profile_root_dir: String,
    pub user_data_dir: String,
    pub cache_data_dir: String,
    pub runtime_handle: Option<EngineRuntimeHandle>,
    pub launch_args: Option<Vec<String>>,
    pub extra_args: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearProfileCacheResponse {
    pub profile_id: String,
    pub cache_data_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProfileResponse {
    pub profile: Profile,
    pub session: EngineSession,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WebRtcMode {
    #[serde(alias = "default", alias = "proxy_only")]
    Real,
    FollowIp,
    Replace,
    Disable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeolocationOverride {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GeolocationMode {
    Off,
    Ip,
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CustomValueMode {
    Real,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OpenProfileOptions {
    pub language: Option<String>,
    pub timezone_id: Option<String>,
    pub startup_urls: Option<Vec<String>>,
    /// 历史兼容字段，仅用于旧调用读取；运行时优先使用 startup_urls。
    pub startup_url: Option<String>,
    pub geolocation_mode: Option<GeolocationMode>,
    pub auto_allow_geolocation: Option<bool>,
    pub geolocation: Option<GeolocationOverride>,
    pub device_name_mode: Option<CustomValueMode>,
    pub custom_device_name: Option<String>,
    pub mac_address_mode: Option<CustomValueMode>,
    pub custom_mac_address: Option<String>,
    pub do_not_track_enabled: Option<bool>,
    pub port_scan_protection: Option<bool>,
    pub automation_detection_shield: Option<bool>,
    pub web_rtc_mode: Option<WebRtcMode>,
    pub webrtc_ip_override: Option<String>,
    pub headless: Option<bool>,
    pub disable_images: Option<bool>,
    pub image_loading_mode: Option<String>,
    pub image_max_area: Option<u32>,
    pub custom_launch_args: Option<Vec<String>>,
    pub fingerprint_seed: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct ManagedCookie {
    pub cookie_id: String,
    pub url: String,
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub secure: Option<bool>,
    pub http_only: Option<bool>,
    pub same_site: Option<String>,
    pub expires: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct CookieStateFile {
    pub environment_id: Option<String>,
    pub managed_cookies: Vec<ManagedCookie>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadProfileCookiesResponse {
    pub json: String,
    pub cookie_count: usize,
    pub site_urls: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExportProfileCookiesMode {
    All,
    Site,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProfileCookiesRequest {
    pub mode: ExportProfileCookiesMode,
    pub url: Option<String>,
    pub export_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProfileCookiesResponse {
    pub path: String,
    pub cookie_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginPackage {
    pub package_id: String,
    pub extension_id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub icon_path: Option<String>,
    pub crx_path: String,
    pub source_type: String,
    pub store_url: Option<String>,
    pub update_url: Option<String>,
    pub latest_version: Option<String>,
    pub update_status: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct SavePluginPackageInput {
    pub package_id: String,
    pub extension_id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub icon_path: Option<String>,
    pub crx_path: String,
    pub source_type: String,
    pub store_url: Option<String>,
    pub update_url: Option<String>,
    pub latest_version: Option<String>,
    pub update_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct ManagedExtension {
    pub package_id: String,
    pub extension_id: String,
    pub source_path: String,
    pub source_type: String,
    pub version: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct ExtensionStateFile {
    pub environment_id: Option<String>,
    pub managed_extensions: Vec<ManagedExtension>,
}

// ── Bookmark types ───────────────────────────────────────────────────────────

/// A single node in the bookmark state file format (matches --bookmark-state-file schema).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BookmarkStateNode {
    pub bookmark_id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<BookmarkStateNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct BookmarkStateRoots {
    #[serde(default)]
    pub bookmark_bar: Vec<BookmarkStateNode>,
    #[serde(default)]
    pub other: Vec<BookmarkStateNode>,
    #[serde(default)]
    pub mobile: Vec<BookmarkStateNode>,
}

/// Bookmark state file — written to disk and passed via --bookmark-state-file.
/// `export_bookmark_state` returns this same structure.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BookmarkStateFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment_id: Option<String>,
    pub roots: BookmarkStateRoots,
}

/// A unified bookmark node for the frontend. When is_live=true, node_id is set
/// and CRUD operations are available. When is_live=false (snapshot), node_id is
/// None and only bookmark_id is available.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkDisplayNode {
    /// Primary identifier: node_id when live, bookmark_id when snapshot.
    pub id: String,
    pub node_id: Option<String>,
    pub bookmark_id: Option<String>,
    #[serde(rename = "type")]
    pub node_type: String,
    pub title: String,
    pub url: Option<String>,
    pub children: Option<Vec<BookmarkDisplayNode>>,
    pub parent_id: Option<String>,
    pub index: Option<u32>,
    pub managed: Option<bool>,
    pub root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkDisplayRoots {
    pub bookmark_bar: Vec<BookmarkDisplayNode>,
    pub other: Vec<BookmarkDisplayNode>,
    pub mobile: Vec<BookmarkDisplayNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetProfileBookmarksResponse {
    pub profile_id: String,
    pub is_live: bool,
    pub snapshot_at: Option<i64>,
    pub roots: BookmarkDisplayRoots,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileBookmarkRequest {
    pub profile_id: String,
    pub parent_id: String,
    pub title: String,
    pub url: Option<String>,
    pub index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileBookmarkRequest {
    pub profile_id: String,
    pub node_id: String,
    pub title: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveProfileBookmarkRequest {
    pub profile_id: String,
    pub node_id: String,
    pub new_parent_id: String,
    pub index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBookmarksRequest {
    pub profile_id: String,
    /// BookmarkStateFile JSON string.
    pub state_json: String,
    /// "mount_as_folder" | "merge" | "replace"
    pub strategy: String,
    /// Folder title when strategy="mount_as_folder"
    pub folder_title: Option<String>,
}

// ── End bookmark types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPluginByExtensionIdRequest {
    pub extension_id: String,
    pub proxy_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginDownloadPreference {
    pub proxy_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPluginToProfilesRequest {
    pub package_id: String,
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfilePluginsRequest {
    pub selections: Vec<ProfilePluginSelection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileVisualRequest {
    pub browser_bg_color_mode: Option<BrowserBgColorMode>,
    pub browser_bg_color: Option<String>,
    pub toolbar_label_mode: Option<ToolbarLabelMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProfileActionRequest {
    #[serde(alias = "profile_ids")]
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProfileGroupRequest {
    pub group_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSetProfileGroupRequest {
    #[serde(alias = "profile_ids")]
    pub profile_ids: Vec<String>,
    #[serde(alias = "group_name")]
    pub group_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProfileActionItem {
    pub profile_id: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProfileActionResponse {
    pub total: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub items: Vec<BatchProfileActionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchWindowActionRequest {
    #[serde(alias = "profile_ids")]
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchWindowOpenRequest {
    #[serde(alias = "profile_ids")]
    pub profile_ids: Vec<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowTab {
    pub tab_id: u64,
    pub title: String,
    pub url: String,
    pub active: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileWindow {
    pub window_id: u64,
    pub focused: bool,
    pub tab_count: usize,
    pub active_tab_id: Option<u64>,
    pub active_tab_url: Option<String>,
    pub bounds: Option<WindowBounds>,
    pub tabs: Vec<WindowTab>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileWindowState {
    pub profile_id: String,
    pub session_id: u64,
    pub pid: Option<u32>,
    pub total_windows: usize,
    pub total_tabs: usize,
    pub windows: Vec<ProfileWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTargetItem {
    pub profile_id: String,
    pub label: String,
    pub host: String,
    pub magic_socket_server_port: Option<u16>,
    pub session_id: u64,
    pub pid: Option<u32>,
    pub total_windows: usize,
    pub total_tabs: usize,
    pub windows: Vec<ProfileWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSyncTargetsResponse {
    pub items: Vec<SyncTargetItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureSyncSidecarStartedResponse {
    pub port: u16,
    pub already_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSyncTextRequest {
    pub text: String,
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WindowArrangeMode {
    Grid,
    Cascade,
    MainWithSidebar,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LastRowAlign {
    Start,
    Center,
    #[default]
    Stretch,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ArrangeFlow {
    #[default]
    RowMajor,
    ColMajor,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum MainPosition {
    #[default]
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ChromeDecorationCompensation {
    Auto,
    #[default]
    Off,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ArrangeOrder {
    #[default]
    Selection,
    Name,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeInsets {
    #[serde(default = "default_edge_inset")]
    pub top: i32,
    #[serde(default = "default_edge_inset")]
    pub right: i32,
    #[serde(default = "default_edge_inset")]
    pub bottom: i32,
    #[serde(default = "default_edge_inset")]
    pub left: i32,
}

fn default_edge_inset() -> i32 {
    12
}

impl Default for EdgeInsets {
    fn default() -> Self {
        Self { top: 12, right: 12, bottom: 12, left: 12 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangeProfileWindowsRequest {
    pub profile_ids: Vec<String>,
    pub monitor_id: String,
    pub mode: WindowArrangeMode,

    // grid 专用（fill 语义，无 fixed 模式）
    pub rows: Option<u32>,
    pub columns: Option<u32>,
    pub gap_x: Option<i32>,
    pub gap_y: Option<i32>,
    #[serde(default)]
    pub padding: EdgeInsets,
    #[serde(default)]
    pub last_row_align: LastRowAlign,
    #[serde(default)]
    pub flow: ArrangeFlow,

    // cascade 专用
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub cascade_step: Option<i32>,

    // mainWithSidebar 专用
    pub main_ratio: Option<f64>,
    #[serde(default)]
    pub main_position: MainPosition,

    // 通用
    #[serde(default)]
    pub order: ArrangeOrder,
    #[serde(default)]
    pub chrome_decoration_compensation: ChromeDecorationCompensation,

    // 向后兼容：旧字段 gap，若 gap_x/gap_y 为 None 则 fallback 到此
    pub gap: Option<i32>,
}

/// 排布快照项，用于"撤销上次"
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangementSnapshotItem {
    pub profile_id: String,
    pub bounds: WindowBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSetWindowBoundsRequest {
    pub profile_ids: Vec<String>,
    pub bounds: WindowBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayMonitorItem {
    pub id: String,
    pub name: String,
    pub is_primary: bool,
    pub is_builtin: bool,
    pub friendly_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub host_device_name: Option<String>,
    pub scale_factor: f64,
    pub position_x: i32,
    pub position_y: i32,
    pub width: u32,
    pub height: u32,
    pub work_area: WindowBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiServerStatus {
    pub running: bool,
    pub bind_address: String,
    pub started_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProxyLifecycle {
    Active,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTargetSiteCheck {
    pub site: String,
    pub reachable: bool,
    pub status_code: Option<u16>,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Proxy {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i32,
    pub username: Option<String>,
    pub password: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub provider: Option<String>,
    pub note: Option<String>,
    pub check_status: Option<String>,
    pub check_message: Option<String>,
    pub last_checked_at: Option<i64>,
    pub exit_ip: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub geo_accuracy_meters: Option<f64>,
    pub suggested_language: Option<String>,
    pub suggested_timezone: Option<String>,
    pub language_source: Option<String>,
    pub custom_language: Option<String>,
    pub effective_language: Option<String>,
    pub timezone_source: Option<String>,
    pub custom_timezone: Option<String>,
    pub effective_timezone: Option<String>,
    pub target_site_checks: Option<Vec<ProxyTargetSiteCheck>>,
    pub expires_at: Option<i64>,
    pub lifecycle: ProxyLifecycle,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProxyRequest {
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i32,
    pub username: Option<String>,
    pub password: Option<String>,
    pub provider: Option<String>,
    pub note: Option<String>,
    pub expires_at: Option<i64>,
    pub language_source: Option<String>,
    pub custom_language: Option<String>,
    pub timezone_source: Option<String>,
    pub custom_timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProxyRequest {
    pub name: Option<String>,
    pub protocol: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub provider: Option<String>,
    pub note: Option<String>,
    pub expires_at: Option<i64>,
    pub language_source: Option<String>,
    pub custom_language: Option<String>,
    pub timezone_source: Option<String>,
    pub custom_timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BatchUpdateProxiesRequest {
    pub proxy_ids: Vec<String>,
    pub payload: UpdateProxyRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteProxiesRequest {
    pub proxy_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProxiesRequest {
    pub protocol: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCheckProxiesRequest {
    pub proxy_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProxyActionItem {
    pub proxy_id: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProxyActionResponse {
    pub total: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub items: Vec<BatchProxyActionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProxiesResponse {
    pub items: Vec<Proxy>,
    pub total: usize,
    pub page: u64,
    pub page_size: u64,
    pub total_pages: u64,
}

#[derive(Debug, Clone)]
pub struct ListProxiesQuery {
    pub include_deleted: bool,
    pub page: u64,
    pub page_size: u64,
    pub keyword: Option<String>,
    pub protocol: Option<String>,
    pub country: Option<String>,
    pub check_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileProxyBinding {
    pub profile_id: String,
    pub proxy_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceItem {
    pub id: String,
    pub kind: String,
    pub version: String,
    pub platform: String,
    pub url: String,
    pub file_name: String,
    pub installed: bool,
    pub local_path: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceCatalogResponse {
    pub source: String,
    pub items: Vec<ResourceItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDownloadResponse {
    pub id: String,
    pub local_path: String,
    pub bytes: u64,
    pub skipped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInstallResponse {
    pub id: String,
    pub version: String,
    pub executable_path: String,
    pub activated: bool,
    pub skipped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceActivateResponse {
    pub version: String,
    pub executable_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceProgressSnapshot {
    pub task_id: String,
    pub resource_id: String,
    pub stage: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f64>,
    pub message: String,
    pub updated_at: i64,
}

pub fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

// ─── Automation ───────────────────────────────────────────────────────────────

/// 人工介入超时处理策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WaitForUserTimeout {
    /// 超时后继续执行（output_key 存空字符串）
    Continue,
    /// 超时后将当前步骤标记为失败
    Fail,
}

/// 确认对话框超时处理策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfirmDialogTimeout {
    /// 超时后视为确认
    Confirm,
    /// 超时后视为取消
    Cancel,
}

/// 弹窗按钮定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogButton {
    pub text: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}

/// Loop 模式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoopMode {
    /// 固定次数循环
    Count,
    /// 条件循环
    While,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SelectorType {
    #[default]
    Css,
    Xpath,
    Text,
}

impl SelectorType {
    pub fn is_css(&self) -> bool {
        *self == SelectorType::Css
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ClipboardAction {
    #[default]
    Copy,
    Paste,
    SelectAll,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TextSource {
    #[default]
    Inline,
    File,
    Variable,
}

fn default_one_u32() -> u32 {
    1
}

fn default_true() -> bool {
    true
}

fn default_captcha_type() -> String {
    "auto".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScriptStep {
    Navigate {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    Wait {
        ms: u64,
    },
    Click {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
    },
    Type {
        selector: String,
        text: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
    },
    Screenshot {
        #[serde(skip_serializing_if = "Option::is_none")]
        save_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    Magic {
        command: String,
        params: serde_json::Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    Cdp {
        method: String,
        params: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 暂停脚本，等待人工确认或输入
    WaitForUser {
        /// 弹窗显示的提示信息，支持 {{var}} 插值
        message: String,
        /// 有值时弹窗显示输入框，label 为输入框描述
        #[serde(skip_serializing_if = "Option::is_none")]
        input_label: Option<String>,
        /// 将用户输入存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        /// 超时毫秒数，None 表示无限等待
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        /// 超时处理策略，默认 Continue
        #[serde(default = "default_wait_for_user_timeout")]
        on_timeout: WaitForUserTimeout,
    },
    /// 条件分支（if/else）
    Condition {
        /// 条件表达式，支持 {{var}} 插值和简单比较
        condition_expr: String,
        /// 条件为真时执行的步骤
        then_steps: Vec<ScriptStep>,
        /// 条件为假时执行的步骤（可为空）
        #[serde(default)]
        else_steps: Vec<ScriptStep>,
    },
    /// 循环（固定次数或 while 条件）
    Loop {
        #[serde(default = "default_loop_mode")]
        mode: LoopMode,
        /// Count 模式：循环次数
        #[serde(skip_serializing_if = "Option::is_none")]
        count: Option<u64>,
        /// While 模式：循环条件表达式
        #[serde(skip_serializing_if = "Option::is_none")]
        condition_expr: Option<String>,
        /// While 模式安全上限，防止无限循环
        #[serde(skip_serializing_if = "Option::is_none")]
        max_iterations: Option<u64>,
        /// 当前迭代索引（0起）存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        iter_var: Option<String>,
        /// 循环体步骤
        body_steps: Vec<ScriptStep>,
    },
    /// 跳出当前循环
    Break,
    /// 跳到循环下一次迭代
    Continue,
    /// 结束整个流程（不再执行后续步骤）
    End {
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    /// 打印调试信息到运行日志，支持 {{var}} 插值
    Print {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        level: Option<String>,
    },

    // ── AI 步骤 ───────────────────────────────────────────────────────────────
    /// AI Agent：多轮工具调用循环，AI 自主决定是否调用工具
    AiAgent {
        /// 用户提示词，支持 {{var}} 插值
        prompt: String,
        /// 可选系统提示词
        #[serde(skip_serializing_if = "Option::is_none")]
        system_prompt: Option<String>,
        /// 输出格式: "text"（默认）或 "json"
        #[serde(default = "default_ai_output_format")]
        output_format: String,
        /// json 模式下，JSON path → 变量映射
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        output_key_map: Vec<AiOutputKeyMapping>,
        /// 最大工具调用轮次
        max_steps: u32,
        /// 将最终 AI 回复存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        /// 覆盖全局 AI 模型
        #[serde(skip_serializing_if = "Option::is_none")]
        model_override: Option<String>,
        /// 可用工具类别筛选（空 = 全部启用）
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        tool_categories: Vec<String>,
    },

    /// AI 判断：AI 自主决定是否需要调用工具来辅助判断，输出 true/false 或百分比
    AiJudge {
        /// 判断提示词，描述需要 AI 判断的场景，支持 {{var}} 插值
        prompt: String,
        /// 输出模式: "boolean" 输出 true/false, "percentage" 输出 0-100
        #[serde(default = "default_judge_output_mode")]
        output_mode: String,
        /// 最大工具调用轮次
        #[serde(default = "default_judge_max_steps")]
        max_steps: u32,
        /// 覆盖全局 AI 模型
        #[serde(skip_serializing_if = "Option::is_none")]
        model_override: Option<String>,
        /// 将判断结果存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        /// 可用工具类别筛选（空 = 全部启用）
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        tool_categories: Vec<String>,
    },

    // ── Magic Controller 具名步骤 ─────────────────────────────────────────────

    // 窗口外观
    MagicSetBounds {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetBounds {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicSetMaximized,
    MagicSetMinimized,
    MagicSetClosed,
    MagicSafeQuit,
    MagicSetRestored,
    MagicSetFullscreen,
    MagicSetBgColor {
        #[serde(skip_serializing_if = "Option::is_none")]
        r: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        g: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        b: Option<u8>,
    },
    MagicSetToolbarText {
        text: String,
    },
    MagicSetAppTopMost,
    MagicSetMasterIndicatorVisible {
        #[serde(skip_serializing_if = "Option::is_none")]
        visible: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },

    // 标签页与窗口操作
    MagicOpenNewTab {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicCloseTab {
        tab_id: i64,
    },
    MagicActivateTab {
        tab_id: i64,
    },
    MagicActivateTabByIndex {
        index: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
    },
    MagicCloseInactiveTabs,
    MagicOpenNewWindow {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicTypeString {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
    },

    // 浏览器信息查询
    MagicGetBrowsers {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetActiveBrowser {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetTabs {
        browser_id: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetActiveTabs {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetSwitches {
        key: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetHostName {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetMacAddress {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // 书签
    MagicGetBookmarks {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicCreateBookmark {
        parent_id: String,
        title: String,
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicCreateBookmarkFolder {
        parent_id: String,
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicUpdateBookmark {
        node_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        url: Option<String>,
    },
    MagicMoveBookmark {
        node_id: String,
        new_parent_id: String,
    },
    MagicRemoveBookmark {
        node_id: String,
    },
    MagicBookmarkCurrentTab {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parent_id: Option<String>,
    },
    MagicUnbookmarkCurrentTab {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
    },
    MagicIsCurrentTabBookmarked {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicExportBookmarkState {
        #[serde(skip_serializing_if = "Option::is_none")]
        environment_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // Cookie
    MagicGetManagedCookies {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicExportCookieState {
        mode: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        url: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        environment_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // 扩展
    MagicGetManagedExtensions {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicTriggerExtensionAction {
        extension_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
    },
    MagicCloseExtensionPopup {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
    },
    /// 启用扩展
    MagicEnableExtension {
        extension_id: String,
    },
    /// 禁用扩展
    MagicDisableExtension {
        extension_id: String,
    },

    // AI Agent 语义化操作
    MagicGetBrowser {
        browser_id: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicClickAt {
        grid: String,
        position: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        button: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        modifiers: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        click_count: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        action: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicClickElement {
        target: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetUiElements {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicNavigateTo {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicQueryDom {
        by: String,
        selector: String,
        #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
        r#match: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        limit: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        visible_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicClickDom {
        by: String,
        selector: String,
        #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
        r#match: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        visible_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicFillDom {
        by: String,
        selector: String,
        value: String,
        #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
        r#match: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        clear: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        visible_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicSendKeys {
        keys: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetPageInfo {
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicScroll {
        #[serde(skip_serializing_if = "Option::is_none")]
        direction: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        distance: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        by: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        visible_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicSetDockIconText {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetPageContent {
        #[serde(skip_serializing_if = "Option::is_none")]
        mode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tab_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        viewport_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_elements: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_text_length: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_depth: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        include_hidden: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        regions: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        exclude_regions: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // 同步模式
    MagicToggleSyncMode {
        role: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetSyncMode {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetIsMaster {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    MagicGetSyncStatus {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── CDP 具名步骤 ──────────────────────────────────────────────────────────
    CdpNavigate {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    CdpReload {
        #[serde(default)]
        ignore_cache: bool,
    },
    CdpClick {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
    },
    CdpType {
        selector: String,
        text: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
    },
    CdpScrollTo {
        #[serde(skip_serializing_if = "Option::is_none")]
        selector: Option<String>,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        #[serde(skip_serializing_if = "Option::is_none")]
        x: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        y: Option<i32>,
    },
    CdpWaitForSelector {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    CdpWaitForPageLoad {
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    /// 批量提取所有匹配元素的文本或属性
    CdpQueryAll {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        #[serde(skip_serializing_if = "Option::is_none")]
        extract: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    CdpGetText {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    CdpGetAttribute {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        attribute: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    CdpSetInputValue {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        value: String,
    },

    /// 增强截图：支持保存文件和多输出变量
    CdpScreenshot {
        #[serde(skip_serializing_if = "Option::is_none")]
        format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        quality: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key_base64: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key_file_path: Option<String>,
    },

    // 截图（整个 app 壳）— 始终 mode=file，与 CdpScreenshot 一致
    MagicCaptureAppShell {
        #[serde(skip_serializing_if = "Option::is_none")]
        browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key_file_path: Option<String>,
    },

    // ── CDP 新增步骤 ─────────────────────────────────────────────────────────
    /// 新建标签页，返回 targetId
    CdpOpenNewTab {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    /// 获取所有标签页信息（JSON 数组）
    CdpGetAllTabs {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    /// 切换到指定 targetId 的标签页
    CdpSwitchTab {
        target_id: String,
    },

    /// 关闭指定 targetId 的标签页（用 target_id 区别于 MagicCloseTab 的 tab_id）
    #[serde(rename = "cdp_close_tab")]
    CdpCloseTabByTarget {
        target_id: String,
    },

    /// 浏览器后退，steps 为步数（默认 1）
    CdpGoBack {
        #[serde(default = "default_one_u32")]
        steps: u32,
    },

    /// 浏览器前进，steps 为步数（默认 1）
    CdpGoForward {
        #[serde(default = "default_one_u32")]
        steps: u32,
    },

    /// 上传文件到 file input 元素
    CdpUploadFile {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        files: Vec<String>,
    },

    /// 设置浏览器下载目录
    CdpDownloadFile {
        download_path: String,
    },

    /// 剪贴板操作（复制/粘贴/全选）
    CdpClipboard {
        #[serde(default)]
        action: ClipboardAction,
    },

    CdpExecuteJs {
        #[serde(skip_serializing_if = "Option::is_none")]
        expression: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        file_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    /// 增强文本输入：支持内联、文件、变量三种来源
    CdpInputText {
        selector: String,
        #[serde(default, skip_serializing_if = "SelectorType::is_css")]
        selector_type: SelectorType,
        #[serde(default)]
        text_source: TextSource,
        #[serde(skip_serializing_if = "Option::is_none")]
        text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        file_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        var_name: Option<String>,
    },

    /// 发送单个按键（keyDown + keyUp）
    CdpPressKey {
        key: String,
    },

    /// 发送快捷键组合（修饰键 + 主键）
    CdpShortcut {
        #[serde(default)]
        modifiers: Vec<String>,
        key: String,
    },

    // ── 弹窗步骤 ──────────────────────────────────────────────────────────────
    /// 确认对话框：支持 1-4 个自定义按钮，阻塞执行
    ConfirmDialog {
        title: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        buttons: Option<Vec<DialogButton>>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        button_branches: Vec<Vec<ScriptStep>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        confirm_text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cancel_text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        #[serde(default = "default_confirm_dialog_timeout")]
        on_timeout: ConfirmDialogTimeout,
        #[serde(skip_serializing_if = "Option::is_none")]
        on_timeout_value: Option<String>,
    },
    /// 选择对话框：从预定义选项中选择，阻塞执行
    SelectDialog {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        options: Vec<String>,
        #[serde(default)]
        multi_select: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    /// 非阻塞通知（toast），不暂停执行流
    Notification {
        title: String,
        body: String,
        #[serde(default = "default_notification_level")]
        level: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },

    /// 表单对话框：多字段输入，阻塞执行
    FormDialog {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        fields: Vec<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        submit_label: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        #[serde(default = "default_confirm_dialog_timeout")]
        on_timeout: ConfirmDialogTimeout,
    },
    /// 数据表格对话框：展示结构化数据，可选择行，阻塞执行
    TableDialog {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        columns: Vec<serde_json::Value>,
        rows: Vec<serde_json::Value>,
        #[serde(default)]
        selectable: bool,
        #[serde(default)]
        multi_select: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_height: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    /// 图片预览对话框：展示图片，可附带输入框，阻塞执行
    ImageDialog {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
        /// base64 图片数据或文件路径
        image: String,
        #[serde(default = "default_image_format")]
        image_format: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input_label: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        input_placeholder: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    /// 倒计时确认对话框：危险操作前的缓冲时间，阻塞执行
    CountdownDialog {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        message: String,
        seconds: u32,
        #[serde(default = "default_countdown_level")]
        level: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        action_label: Option<String>,
        #[serde(default)]
        auto_proceed: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// Markdown 富文本对话框：展示格式化内容，阻塞执行
    MarkdownDialog {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        max_height: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        width: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        actions: Option<Vec<DialogButton>>,
        #[serde(default)]
        copyable: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    /// 处理浏览器 JavaScript 对话框（alert/confirm/prompt）
    CdpHandleDialog {
        /// "accept" 或 "dismiss"
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        prompt_text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── CDP 信息查询步骤 ─────────────────────────────────────────────────────
    /// 获取浏览器版本信息 (Browser.getVersion)
    CdpGetBrowserVersion {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取浏览器启动命令行参数 (Browser.getBrowserCommandLine)
    CdpGetBrowserCommandLine {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取目标所在浏览器窗口信息 (Browser.getWindowForTarget)
    CdpGetWindowForTarget {
        #[serde(skip_serializing_if = "Option::is_none")]
        target_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取页面布局指标 (Page.getLayoutMetrics)
    CdpGetLayoutMetrics {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取 DOM 根节点 (DOM.getDocument)
    CdpGetDocument {
        #[serde(skip_serializing_if = "Option::is_none")]
        depth: Option<i32>,
        #[serde(default)]
        pierce: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取完整无障碍树 (Accessibility.getFullAXTree)
    CdpGetFullAxTree {
        #[serde(skip_serializing_if = "Option::is_none")]
        depth: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── CDP Cookie & 存储步骤 ─────────────────────────────────────────────────
    /// 获取当前页面或指定 URL 的 cookies (Network.getCookies)
    CdpGetCookies {
        #[serde(skip_serializing_if = "Option::is_none")]
        urls: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 设置单个 cookie (Network.setCookie)
    CdpSetCookie {
        name: String,
        value: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        domain: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expires: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        http_only: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        secure: Option<bool>,
    },
    /// 删除匹配的 cookies (Network.deleteCookies)
    CdpDeleteCookies {
        name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        domain: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        path: Option<String>,
    },
    /// 读取 localStorage (Runtime.evaluate)
    CdpGetLocalStorage {
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 写入 localStorage (Runtime.evaluate)
    CdpSetLocalStorage {
        key: String,
        value: String,
    },
    /// 读取 sessionStorage (Runtime.evaluate)
    CdpGetSessionStorage {
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 清除指定来源的存储数据 (Storage.clearDataForOrigin)
    CdpClearStorage {
        #[serde(skip_serializing_if = "Option::is_none")]
        origin: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        storage_types: Option<String>,
    },

    // ── CDP 页面 & 导航步骤 ───────────────────────────────────────────────────
    /// 获取当前页面 URL (Runtime.evaluate)
    CdpGetCurrentUrl {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取页面 HTML 源码 (Runtime.evaluate)
    CdpGetPageSource {
        #[serde(skip_serializing_if = "Option::is_none")]
        selector: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 等待页面导航完成 (轮询 document.readyState)
    CdpWaitForNavigation {
        #[serde(skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },

    // ── CDP 模拟步骤 ─────────────────────────────────────────────────────────
    /// 模拟移动设备 (Emulation.setDeviceMetricsOverride + setUserAgentOverride)
    CdpEmulateDevice {
        width: u32,
        height: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        device_scale_factor: Option<f64>,
        #[serde(default)]
        mobile: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        user_agent: Option<String>,
    },
    /// 模拟地理位置 (Emulation.setGeolocationOverride)
    CdpSetGeolocation {
        latitude: f64,
        longitude: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        accuracy: Option<f64>,
    },
    /// 运行时修改 User-Agent (Emulation.setUserAgentOverride)
    CdpSetUserAgent {
        user_agent: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        platform: Option<String>,
    },

    // ── CDP 元素 & 输入步骤 ───────────────────────────────────────────────────
    /// 获取元素包围盒坐标 (getBoundingClientRect)
    CdpGetElementBox {
        selector: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 高亮显示页面元素 (注入临时 CSS)
    CdpHighlightElement {
        selector: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    /// 移动鼠标到指定坐标 (Input.dispatchMouseEvent mouseMoved)
    CdpMouseMove {
        x: f64,
        y: f64,
    },
    /// 拖拽元素 (dispatchMouseEvent 序列)
    CdpDragAndDrop {
        #[serde(skip_serializing_if = "Option::is_none")]
        from_selector: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        to_selector: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        from_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        from_y: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        to_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        to_y: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
    },
    /// 选择下拉框选项 (Runtime.evaluate)
    CdpSelectOption {
        selector: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 勾选/取消勾选 checkbox 或 radio (Runtime.evaluate)
    CdpCheckCheckbox {
        selector: String,
        #[serde(default = "default_true")]
        checked: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        selector_type: Option<String>,
    },

    // ── CDP 网络 & 导出步骤 ───────────────────────────────────────────────────
    /// 屏蔽匹配模式的 URL (Network.setBlockedURLs)
    CdpBlockUrls {
        patterns: Vec<String>,
    },
    /// 将当前页面导出为 PDF (Page.printToPDF)
    CdpPdf {
        #[serde(skip_serializing_if = "Option::is_none")]
        path: Option<String>,
        #[serde(default)]
        landscape: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        scale: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        paper_width: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        paper_height: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 拦截并修改网络请求 (Fetch.enable + Fetch.requestPaused)
    CdpInterceptRequest {
        url_pattern: String,
        /// "block" | "mock" | "modify"
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        body: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<u16>,
    },

    // ── CDP 事件缓冲步骤 ─────────────────────────────────────────────────────
    /// 获取浏览器控制台日志 (通过 JS 注入收集)
    CdpGetConsoleLogs {
        #[serde(skip_serializing_if = "Option::is_none")]
        limit: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        level: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取最近的网络请求记录 (通过 JS 注入收集)
    CdpGetNetworkRequests {
        #[serde(skip_serializing_if = "Option::is_none")]
        limit: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        url_pattern: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 获取网络请求的响应体 (通过 JS 拦截 fetch/XHR)
    CdpGetResponseBody {
        #[serde(skip_serializing_if = "Option::is_none")]
        url_filter: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        limit: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── Magic Controller 新增步骤 ─────────────────────────────────────────────
    /// 查询窗口是否最大化
    MagicGetMaximized {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 查询窗口是否最小化
    MagicGetMinimized {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 查询窗口是否全屏
    MagicGetFullscreen {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 一次性获取窗口完整状态
    MagicGetWindowState {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 批量导入 cookies 到浏览器 (循环 Network.setCookie)
    MagicImportCookies {
        cookies: serde_json::Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── App 新增步骤 ─────────────────────────────────────────────────────────
    /// 在指定环境中触发另一个自动化脚本运行
    AppRunScript {
        script_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        profile_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        initial_vars: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── CAPTCHA 步骤 ──────────────────────────────────────────────────────
    /// 检测页面上的 CAPTCHA 类型和参数
    CaptchaDetect {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 求解 CAPTCHA 并返回 token
    CaptchaSolve {
        /// "recaptcha_v2" | "recaptcha_v3" | "hcaptcha" | "turnstile" | "geetest" | "funcaptcha" | "image" | "auto"
        #[serde(default = "default_captcha_type")]
        captcha_type: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        sitekey: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        page_action: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        image_base64: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 将 token 注入页面表单
    CaptchaInjectToken {
        /// "recaptcha" | "hcaptcha" | "turnstile"
        #[serde(rename = "type")]
        captcha_type: String,
        token: String,
    },
    /// 一键：检测 → 求解 → 注入
    CaptchaSolveAndInject {
        #[serde(default)]
        auto_submit: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
    /// 查询求解服务余额
    CaptchaGetBalance {
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub index: usize,
    pub status: String,
    pub output: Option<String>,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "std::collections::HashMap::is_empty", default)]
    pub vars_set: std::collections::HashMap<String, String>,
    /// 步骤在嵌套结构中的完整路径，如 [2, 0] 表示第 3 个步骤的第 1 个子步骤
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub step_path: Vec<usize>,
}

/// 运行日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunLogEntry {
    /// 时间戳（毫秒）
    pub timestamp: i64,
    /// 日志级别: "info" | "warn" | "error" | "debug"
    pub level: String,
    /// 分类: "flow" | "step" | "ai" | "cdp" | "magic" | "error"
    pub category: String,
    /// 简短消息
    pub message: String,
    /// 详细数据（可选，JSON 对象）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    /// 产生此日志的环境 ID（可选，旧记录为 None）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    /// 产生此日志的环境名称（可选，旧记录为 None）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_delay_ms: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delay_config: Option<RunDelayConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunDelayConfig {
    pub enabled: bool,
    pub min_seconds: f64,
    pub max_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationScript {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<ScriptStep>,
    pub canvas_positions_json: Option<String>,
    pub variables_schema_json: Option<String>,
    pub associated_profile_ids: Vec<String>,
    pub ai_config: Option<AiProviderConfig>,
    pub ai_config_id: Option<String>,
    pub settings: Option<ScriptSettings>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRun {
    pub id: String,
    pub script_id: String,
    pub profile_id: String,
    pub status: String,
    pub steps: Vec<ScriptStep>,
    pub results: Option<Vec<StepResult>>,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logs: Option<Vec<RunLogEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAutomationScriptRequest {
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<ScriptStep>,
    pub associated_profile_ids: Option<Vec<String>>,
    pub ai_config: Option<AiProviderConfig>,
    pub ai_config_id: Option<String>,
    pub settings: Option<ScriptSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAutomationCanvasGraphRequest {
    pub steps: Vec<ScriptStep>,
    pub positions_json: String,
    pub settings: Option<ScriptSettings>,
}

/// AI 输出字段映射（用于 JSON 模式提取变量）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiOutputKeyMapping {
    /// 点分路径，如 "data.items.0"
    pub json_path: String,
    /// 存入的变量名
    pub var_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationProgressEvent {
    pub run_id: String,
    pub step_index: usize,
    pub step_total: usize,
    pub step_status: String,
    pub output: Option<String>,
    pub duration_ms: u64,
    pub run_status: String,
    /// 当前步骤写入的变量（key -> value）
    #[serde(skip_serializing_if = "std::collections::HashMap::is_empty", default)]
    pub vars_set: std::collections::HashMap<String, String>,
    /// 嵌套步骤路径（顶层步骤为 [index]，控制流内部步骤为 [outer, inner, ...]）
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub step_path: Vec<usize>,
    /// AI 步骤实时执行详情（仅 ai_agent/ai_judge 步骤）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_detail: Option<AiExecutionDetail>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// AI 步骤执行过程中的实时详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExecutionDetail {
    /// 当前轮次（1-based）
    pub round: usize,
    /// 最大轮次
    pub max_rounds: usize,
    /// 当前阶段：thinking / tool_calling / tool_result / complete
    pub phase: String,
    /// AI 思考/推理文本
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    /// 工具调用列表及状态
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<AiToolCallDetail>>,
}

/// 单个工具调用的详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolCallDetail {
    pub name: String,
    pub arguments: serde_json::Value,
    /// executing / completed / failed
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

fn default_wait_for_user_timeout() -> WaitForUserTimeout {
    WaitForUserTimeout::Continue
}

fn default_loop_mode() -> LoopMode {
    LoopMode::Count
}

fn default_judge_output_mode() -> String {
    "boolean".to_string()
}

fn default_judge_max_steps() -> u32 {
    5
}

fn default_ai_output_format() -> String {
    "text".to_string()
}

fn default_confirm_dialog_timeout() -> ConfirmDialogTimeout {
    ConfirmDialogTimeout::Cancel
}

fn default_notification_level() -> String {
    "info".to_string()
}

fn default_image_format() -> String {
    "png".to_string()
}

fn default_countdown_level() -> String {
    "warning".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationVariablesUpdatedEvent {
    pub run_id: String,
    pub vars: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// 发给前端的人工介入请求事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationHumanRequiredEvent {
    pub run_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
    /// 弹窗类型: "wait_for_user" | "confirm" | "select"
    pub dialog_type: String,
    pub message: String,
    pub input_label: Option<String>,
    pub timeout_ms: Option<u64>,
    /// 当前步骤路径，用于高亮画布节点
    pub step_path: Vec<usize>,
    // ── 扩展字段（confirm_dialog / select_dialog 使用）──
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirm_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancel_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multi_select: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buttons: Option<Vec<DialogButton>>,

    // ── 扩展字段（form/table/image/countdown/markdown 使用）──
    /// form 弹窗字段定义
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<serde_json::Value>>,
    /// 提交按钮文字
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submit_label: Option<String>,
    /// table 弹窗列定义
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<Vec<serde_json::Value>>,
    /// table 弹窗行数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<serde_json::Value>>,
    /// 是否可选行
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selectable: Option<bool>,
    /// 表格/内容最大高度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_height: Option<u32>,
    /// 图片数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    /// 图片格式
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_format: Option<String>,
    /// 输入框占位符
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_placeholder: Option<String>,
    /// 倒计时秒数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seconds: Option<u32>,
    /// 操作按钮文字
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_label: Option<String>,
    /// 是否自动执行
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_proceed: Option<bool>,
    /// markdown 内容
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// 弹窗宽度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<String>,
    /// 是否可复制
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copyable: Option<bool>,
    /// 消息级别
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
}

/// 人工介入已解除（用户点击继续或超时）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationHumanDismissedEvent {
    pub run_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationStepErrorPauseEvent {
    pub run_id: String,
    pub step_index: usize,
    pub error_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// 运行已取消
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunCancelledEvent {
    pub run_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// 自动化步骤发出的非阻塞通知
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationNotificationEvent {
    pub run_id: String,
    pub title: String,
    pub body: String,
    /// "info" | "success" | "warning" | "error"
    pub level: String,
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

// ── Bookmark Template types (Phase 3/4/5) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkTemplateItem {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>,
    pub tree_json: String,
    pub version: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookmarkTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>,
    pub tree_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookmarkTemplateRequest {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<String>,
    pub tree_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyBookmarkTemplateRequest {
    pub template_id: i64,
    pub profile_ids: Vec<String>,
    pub strategy: String,
    pub folder_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkTemplateSubscription {
    pub id: i64,
    pub template_id: i64,
    pub profile_id: String,
    pub sync_mode: String,
    pub strategy: String,
    pub applied_version: Option<i64>,
    pub applied_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeTemplateRequest {
    pub template_id: i64,
    pub profile_id: String,
    pub sync_mode: String,
    pub strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkDiffEntry {
    pub title: String,
    pub url: Option<String>,
    pub path: String,
    pub node_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkDiffResult {
    pub added: Vec<BookmarkDiffEntry>,
    pub removed: Vec<BookmarkDiffEntry>,
    pub modified: Vec<BookmarkDiffEntry>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{BatchProfileActionRequest, BatchSetProfileGroupRequest, BatchWindowOpenRequest};

    #[test]
    fn batch_requests_accept_snake_case_profile_ids() {
        let batch_profile: BatchProfileActionRequest = serde_json::from_value(json!({
            "profile_ids": ["pf_000013", "pf_000014"]
        }))
        .expect("deserialize batch profile action request");
        assert_eq!(batch_profile.profile_ids.len(), 2);

        let batch_group: BatchSetProfileGroupRequest = serde_json::from_value(json!({
            "profile_ids": ["pf_000013"],
            "group_name": "macOS"
        }))
        .expect("deserialize batch set group request");
        assert_eq!(batch_group.profile_ids, vec!["pf_000013".to_string()]);
        assert_eq!(batch_group.group_name.as_deref(), Some("macOS"));

        let batch_window: BatchWindowOpenRequest = serde_json::from_value(json!({
            "profile_ids": ["pf_000013", "pf_000014"],
            "url": "https://www.google.com"
        }))
        .expect("deserialize batch window open request");
        assert_eq!(batch_window.profile_ids.len(), 2);
        assert_eq!(batch_window.url.as_deref(), Some("https://www.google.com"));
    }
}
