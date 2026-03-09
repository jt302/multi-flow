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
    pub web_rtc_mode: Option<WebRtcMode>,
    pub webrtc_ip_override: Option<String>,
    /// 历史兼容字段，仅用于旧数据懒迁移；运行时应优先读取 fingerprint_snapshot.custom_cpu_cores。
    pub custom_cpu_cores: Option<u32>,
    /// 历史兼容字段，仅用于旧数据懒迁移；运行时应优先读取 fingerprint_snapshot.custom_ram_gb。
    pub custom_ram_gb: Option<u32>,
    /// 自定义字体列表。当 font_list_mode = custom 时，保存/预览/启动都会使用该列表。
    pub custom_font_list: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAdvancedSettings {
    pub headless: Option<bool>,
    pub disable_images: Option<bool>,
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
pub struct OpenProfileResponse {
    pub profile: Profile,
    pub session: EngineSession,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WebRtcMode {
    #[serde(alias = "default", alias = "proxy_only")]
    Real,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OpenProfileOptions {
    pub language: Option<String>,
    pub timezone_id: Option<String>,
    pub startup_url: Option<String>,
    pub geolocation: Option<GeolocationOverride>,
    pub web_rtc_mode: Option<WebRtcMode>,
    pub webrtc_ip_override: Option<String>,
    pub headless: Option<bool>,
    pub disable_images: Option<bool>,
    pub custom_launch_args: Option<Vec<String>>,
    pub fingerprint_seed: Option<u32>,
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
    pub profile_ids: Vec<String>,
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
    pub profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchWindowOpenRequest {
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
    pub last_status: Option<String>,
    pub last_checked_at: Option<i64>,
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
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub provider: Option<String>,
    pub note: Option<String>,
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
    pub last_status: Option<String>,
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
