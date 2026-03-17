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
    pub startup_urls: Option<Vec<String>>,
    /// 历史兼容字段，仅用于旧调用读取；运行时优先使用 startup_urls。
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
pub struct SetProfileGroupRequest {
    pub group_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSetProfileGroupRequest {
    pub profile_ids: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaFlowLifecycle {
    Active,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaTaskLifecycle {
    Active,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaTaskRunType {
    Manual,
    Scheduled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaExecutionMode {
    Serial,
    Parallel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaRunStatus {
    Queued,
    Running,
    PartialSuccess,
    Success,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaRunInstanceStatus {
    Queued,
    Running,
    NeedsManual,
    Success,
    Failed,
    Cancelled,
    Interrupted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RpaRunStepStatus {
    Running,
    Success,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaRunDefaults {
    pub concurrency_limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(transparent)]
pub struct RpaFlowNodeConfig(pub serde_json::Map<String, serde_json::Value>);

impl RpaFlowNodeConfig {
    pub fn empty() -> Self {
        Self(serde_json::Map::new())
    }

    pub fn get_str(&self, key: &str) -> Option<String> {
        self.0
            .get(key)
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
    }

    pub fn get_u64(&self, key: &str) -> Option<u64> {
        self.0.get(key).and_then(|value| value.as_u64())
    }

    pub fn get_i64(&self, key: &str) -> Option<i64> {
        self.0.get(key).and_then(|value| value.as_i64())
    }

    pub fn get_bool(&self, key: &str) -> Option<bool> {
        self.0.get(key).and_then(|value| value.as_bool())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlowNodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlowNode {
    pub id: String,
    pub kind: String,
    pub position: RpaFlowNodePosition,
    pub config: RpaFlowNodeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlowVariable {
    pub key: String,
    pub label: String,
    pub required: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlowDefinition {
    pub nodes: Vec<RpaFlowNode>,
    pub edges: Vec<RpaFlowEdge>,
    pub entry_node_id: String,
    pub variables: Vec<RpaFlowVariable>,
    pub defaults: RpaRunDefaults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaFlow {
    pub id: String,
    pub name: String,
    pub note: Option<String>,
    pub lifecycle: RpaFlowLifecycle,
    pub definition: RpaFlowDefinition,
    pub default_target_profile_ids: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub last_run_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRpaFlowRequest {
    pub name: String,
    pub note: Option<String>,
    pub definition: RpaFlowDefinition,
    pub default_target_profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRpaFlowRequest {
    pub name: String,
    pub note: Option<String>,
    pub definition: RpaFlowDefinition,
    pub default_target_profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaTask {
    pub id: String,
    pub flow_id: String,
    pub flow_name: String,
    pub name: String,
    pub run_type: RpaTaskRunType,
    pub execution_mode: RpaExecutionMode,
    pub concurrency_limit: u32,
    pub cron_expr: Option<String>,
    pub start_at: Option<i64>,
    pub timezone: String,
    pub enabled: bool,
    pub runtime_input: serde_json::Map<String, serde_json::Value>,
    pub target_profile_ids: Vec<String>,
    pub lifecycle: RpaTaskLifecycle,
    pub deleted_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRpaTaskRequest {
    pub flow_id: String,
    pub name: String,
    pub run_type: RpaTaskRunType,
    pub execution_mode: RpaExecutionMode,
    pub concurrency_limit: Option<u32>,
    pub cron_expr: Option<String>,
    pub start_at: Option<i64>,
    pub timezone: Option<String>,
    pub target_profile_ids: Vec<String>,
    pub runtime_input: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRpaTaskRequest {
    pub flow_id: String,
    pub name: String,
    pub run_type: RpaTaskRunType,
    pub execution_mode: RpaExecutionMode,
    pub concurrency_limit: Option<u32>,
    pub cron_expr: Option<String>,
    pub start_at: Option<i64>,
    pub timezone: Option<String>,
    pub target_profile_ids: Vec<String>,
    pub runtime_input: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleRpaTaskEnabledRequest {
    pub task_id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRpaTaskRequest {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunRpaFlowRequest {
    pub flow_id: String,
    pub target_profile_ids: Vec<String>,
    pub concurrency_limit: Option<u32>,
    pub runtime_input: serde_json::Map<String, serde_json::Value>,
    pub trigger_source: Option<String>,
    pub task_id: Option<String>,
    pub task_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelRpaRunRequest {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeRpaInstanceRequest {
    pub instance_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListRpaRunsRequest {
    pub limit: Option<u64>,
    pub task_id: Option<String>,
    pub status: Option<RpaRunStatus>,
    pub trigger_source: Option<String>,
    pub created_from: Option<i64>,
    pub created_to: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaRun {
    pub id: String,
    pub flow_id: String,
    pub flow_name: String,
    pub task_id: Option<String>,
    pub task_name: Option<String>,
    pub trigger_source: String,
    pub status: RpaRunStatus,
    pub total_instances: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub cancelled_count: usize,
    pub concurrency_limit: u32,
    pub definition_snapshot: RpaFlowDefinition,
    pub runtime_input: serde_json::Map<String, serde_json::Value>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RpaArtifactIndex {
    pub screenshot_path: Option<String>,
    pub html_path: Option<String>,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaRunInstance {
    pub id: String,
    pub run_id: String,
    pub profile_id: String,
    pub status: RpaRunInstanceStatus,
    pub current_node_id: Option<String>,
    pub context: serde_json::Map<String, serde_json::Value>,
    pub artifact_index: RpaArtifactIndex,
    pub error_message: Option<String>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaRunStep {
    pub id: String,
    pub run_instance_id: String,
    pub node_id: String,
    pub node_kind: String,
    pub status: RpaRunStepStatus,
    pub attempt: u32,
    pub input_snapshot: serde_json::Map<String, serde_json::Value>,
    pub output_snapshot: serde_json::Map<String, serde_json::Value>,
    pub error_message: Option<String>,
    pub artifacts: RpaArtifactIndex,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpaRunDetails {
    pub run: RpaRun,
    pub instances: Vec<RpaRunInstance>,
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
