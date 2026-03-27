use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

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
    pub name: String,
    pub group: Option<String>,
    pub note: Option<String>,
    pub settings: Option<ProfileSettings>,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSettings {
    pub basic: Option<ProfileBasicSettings>,
    pub fingerprint: Option<ProfileFingerprintSettings>,
    pub advanced: Option<ProfileAdvancedSettings>,
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
    pub toolbar_text: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileGroupRequest {
    pub name: String,
    pub note: Option<String>,
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
    pub web_rtc_mode: Option<WebRtcMode>,
    pub webrtc_ip_override: Option<String>,
    pub headless: Option<bool>,
    pub disable_images: Option<bool>,
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
    pub browser_bg_color: Option<String>,
    pub toolbar_text: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArrangeProfileWindowsRequest {
    pub profile_ids: Vec<String>,
    pub monitor_id: String,
    pub mode: WindowArrangeMode,
    pub gap: i32,
    pub width: i32,
    pub height: i32,
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

/// Loop 模式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoopMode {
    /// 固定次数循环
    Count,
    /// 条件循环
    While,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScriptStep {
    Navigate { url: String, #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    Wait { ms: u64 },
    Evaluate { expression: String, result_key: Option<String> },
    Click { selector: String },
    Type { selector: String, text: String },
    Screenshot { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    Magic { command: String, params: serde_json::Value, #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    Cdp { method: String, params: Option<serde_json::Value>, #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
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

    // ── AI 步骤 ───────────────────────────────────────────────────────────────

    /// 文本 / vision prompt，返回 AI 回复文本
    AiPrompt {
        /// 提示词，支持 {{var}} 插值
        prompt: String,
        /// 变量名，值为 base64 图片（用于 vision）
        #[serde(skip_serializing_if = "Option::is_none")]
        image_var: Option<String>,
        /// 覆盖全局 AI 模型
        #[serde(skip_serializing_if = "Option::is_none")]
        model_override: Option<String>,
        /// 将 AI 回复存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    /// 结构化提取：AI 返回 JSON，按映射写入多个变量
    AiExtract {
        /// 提示词，支持 {{var}} 插值
        prompt: String,
        /// 变量名，值为 base64 图片（用于 vision）
        #[serde(skip_serializing_if = "Option::is_none")]
        image_var: Option<String>,
        /// 输出字段映射列表
        output_key_map: Vec<AiOutputKeyMapping>,
        /// 覆盖全局 AI 模型
        #[serde(skip_serializing_if = "Option::is_none")]
        model_override: Option<String>,
    },

    /// AI Agent：多轮工具调用循环，AI 可调用其他步骤作为 tool
    AiAgent {
        /// 系统提示词
        system_prompt: String,
        /// 初始消息，支持 {{var}} 插值
        initial_message: String,
        /// 最大循环轮次
        max_steps: u32,
        /// 将最终 AI 回复存入此变量
        #[serde(skip_serializing_if = "Option::is_none")]
        output_key: Option<String>,
    },

    // ── Magic Controller 具名步骤 ─────────────────────────────────────────────

    // 窗口外观
    MagicSetBounds {
        x: i32, y: i32, width: u32, height: u32,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicGetBounds { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicSetMaximized,
    MagicSetMinimized,
    MagicSetClosed,
    MagicSetRestored,
    MagicSetFullscreen,
    MagicSetBgColor {
        #[serde(skip_serializing_if = "Option::is_none")] r: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")] g: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")] b: Option<u8>,
    },
    MagicSetToolbarText { text: String },
    MagicSetAppTopMost,
    MagicSetMasterIndicatorVisible {
        #[serde(skip_serializing_if = "Option::is_none")] visible: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")] label: Option<String>,
    },

    // 标签页与窗口操作
    MagicOpenNewTab {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicCloseTab { tab_id: i64 },
    MagicActivateTab { tab_id: i64 },
    MagicActivateTabByIndex {
        index: u32,
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
    },
    MagicCloseInactiveTabs,
    MagicOpenNewWindow { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicTypeString {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")] tab_id: Option<i64>,
    },

    // 浏览器信息查询
    MagicGetBrowsers { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetActiveBrowser { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetTabs {
        browser_id: i64,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicGetActiveTabs { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetSwitches { key: String, #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetHostName { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetMacAddress { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },

    // 书签
    MagicGetBookmarks { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicCreateBookmark {
        parent_id: String, title: String, url: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicCreateBookmarkFolder {
        parent_id: String, title: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicUpdateBookmark {
        node_id: String,
        #[serde(skip_serializing_if = "Option::is_none")] title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] url: Option<String>,
    },
    MagicMoveBookmark { node_id: String, new_parent_id: String },
    MagicRemoveBookmark { node_id: String },
    MagicBookmarkCurrentTab {
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")] parent_id: Option<String>,
    },
    MagicUnbookmarkCurrentTab {
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
    },
    MagicIsCurrentTabBookmarked {
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicExportBookmarkState {
        #[serde(skip_serializing_if = "Option::is_none")] environment_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },

    // Cookie
    MagicGetManagedCookies { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicExportCookieState {
        mode: String,
        #[serde(skip_serializing_if = "Option::is_none")] url: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] environment_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },

    // 扩展
    MagicGetManagedExtensions { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicTriggerExtensionAction {
        extension_id: String,
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
    },
    MagicCloseExtensionPopup {
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
    },

    // 同步模式
    MagicToggleSyncMode {
        role: String,
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")] session_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    MagicGetSyncMode { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetIsMaster { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },
    MagicGetSyncStatus { #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String> },

    // ── CDP 具名步骤 ──────────────────────────────────────────────────────────

    CdpNavigate {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    CdpReload {
        #[serde(default)]
        ignore_cache: bool,
    },
    CdpEvaluate {
        expression: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    CdpClick { selector: String },
    CdpType { selector: String, text: String },
    CdpScrollTo {
        #[serde(skip_serializing_if = "Option::is_none")] selector: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] x: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")] y: Option<i32>,
    },
    CdpWaitForSelector {
        selector: String,
        #[serde(skip_serializing_if = "Option::is_none")] timeout_ms: Option<u64>,
    },
    CdpGetText {
        selector: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    CdpGetAttribute {
        selector: String,
        attribute: String,
        #[serde(skip_serializing_if = "Option::is_none")] output_key: Option<String>,
    },
    CdpSetInputValue { selector: String, value: String },

    /// 增强截图：支持保存文件和多输出变量
    CdpScreenshot {
        #[serde(skip_serializing_if = "Option::is_none")] format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] quality: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")] output_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key_base64: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key_file_path: Option<String>,
    },

    // 截图（整个 app 壳）
    MagicCaptureAppShell {
        #[serde(skip_serializing_if = "Option::is_none")] browser_id: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")] format: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] mode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key_base64: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")] output_key_file_path: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationScript {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<ScriptStep>,
    pub canvas_positions_json: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAutomationScriptRequest {
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<ScriptStep>,
}

/// AiExtract 输出字段映射
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
}

fn default_wait_for_user_timeout() -> WaitForUserTimeout {
    WaitForUserTimeout::Continue
}

fn default_loop_mode() -> LoopMode {
    LoopMode::Count
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationVariablesUpdatedEvent {
    pub run_id: String,
    pub vars: std::collections::HashMap<String, String>,
}

/// 发给前端的人工介入请求事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationHumanRequiredEvent {
    pub run_id: String,
    pub message: String,
    pub input_label: Option<String>,
    pub timeout_ms: Option<u64>,
    /// 当前步骤路径，用于高亮画布节点
    pub step_path: Vec<usize>,
}

/// 人工介入已解除（用户点击继续或超时）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationHumanDismissedEvent {
    pub run_id: String,
}

/// 运行已取消
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunCancelledEvent {
    pub run_id: String,
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
