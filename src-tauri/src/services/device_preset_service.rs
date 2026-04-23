use std::future::Future;
use std::time::{SystemTime, UNIX_EPOCH};

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use crate::db::entities::device_preset;
use crate::error::{AppError, AppResult};
use crate::fingerprint_catalog::{self, FingerprintPresetSpec, FingerprintVariantSpec};
use crate::models::{now_ts, ProfileDevicePreset, SaveProfileDevicePresetRequest};

const BUILTIN_MACOS_PRESET_ID: &str = "macos_macbook_pro_14";

pub struct DevicePresetService {
    db: DatabaseConnection,
}

impl DevicePresetService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn list_presets(
        &self,
        platform: Option<&str>,
        _browser_version: Option<&str>,
    ) -> AppResult<Vec<ProfileDevicePreset>> {
        self.ensure_seeded()?;
        let normalized_platform =
            fingerprint_catalog::normalize_platform(platform).map(str::to_string);
        let mut query = device_preset::Entity::find();
        if let Some(platform) = normalized_platform.as_deref() {
            query = query.filter(device_preset::Column::Platform.eq(platform));
        }
        let items = self.db_query(
            query
                .order_by_asc(device_preset::Column::CreatedAt)
                .all(&self.db),
        )?;
        Ok(items.into_iter().map(|item| to_api_preset(&item)).collect())
    }

    pub fn get_preset(&self, preset_id: &str) -> AppResult<ProfileDevicePreset> {
        self.ensure_seeded()?;
        let model = self.find_preset_model(preset_id)?;
        Ok(to_api_preset(&model))
    }

    pub fn create_preset(
        &self,
        payload: SaveProfileDevicePresetRequest,
    ) -> AppResult<ProfileDevicePreset> {
        self.ensure_seeded()?;
        let normalized = normalize_payload(payload)?;
        let now = now_ts();
        let preset_key = generate_preset_key();
        let active_model = device_preset::ActiveModel {
            preset_key: Set(preset_key),
            label: Set(normalized.label),
            platform: Set(normalized.platform),
            platform_version: Set(normalized.platform_version),
            viewport_width: Set(normalized.viewport_width as i32),
            viewport_height: Set(normalized.viewport_height as i32),
            device_scale_factor: Set(normalized.device_scale_factor),
            touch_points: Set(normalized.touch_points as i32),
            custom_platform: Set(normalized.custom_platform),
            arch: Set(normalized.arch),
            bitness: Set(normalized.bitness),
            mobile: Set(normalized.mobile),
            form_factor: Set(normalized.form_factor),
            user_agent_template: Set(normalized.user_agent_template),
            custom_gl_vendor: Set(normalized.custom_gl_vendor),
            custom_gl_renderer: Set(normalized.custom_gl_renderer),
            custom_cpu_cores: Set(normalized.custom_cpu_cores as i32),
            custom_ram_gb: Set(normalized.custom_ram_gb as i32),
            browser_version: Set(normalized.browser_version),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let result = self.db_query(device_preset::Entity::insert(active_model).exec(&self.db))?;
        let stored = self
            .db_query(device_preset::Entity::find_by_id(result.last_insert_id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound("device preset insert failed".to_string()))?;
        Ok(to_api_preset(&stored))
    }

    pub fn delete_preset(&self, preset_id: &str) -> AppResult<()> {
        if is_builtin_preset_key(preset_id) {
            return Err(AppError::Validation(
                "built-in device presets cannot be deleted".to_string(),
            ));
        }
        let model = self.find_preset_model(preset_id)?;
        let active: device_preset::ActiveModel = model.into();
        self.db_query(active.delete(&self.db))?;
        Ok(())
    }

    pub fn update_preset(
        &self,
        preset_id: &str,
        payload: SaveProfileDevicePresetRequest,
    ) -> AppResult<ProfileDevicePreset> {
        self.ensure_seeded()?;
        if is_builtin_preset_key(preset_id) {
            return Err(AppError::Validation(
                "built-in device presets cannot be updated".to_string(),
            ));
        }
        let stored = self.find_preset_model(preset_id)?;
        let normalized = normalize_payload(payload)?;
        let mut active_model: device_preset::ActiveModel = stored.into();
        active_model.label = Set(normalized.label);
        active_model.platform = Set(normalized.platform);
        active_model.platform_version = Set(normalized.platform_version);
        active_model.viewport_width = Set(normalized.viewport_width as i32);
        active_model.viewport_height = Set(normalized.viewport_height as i32);
        active_model.device_scale_factor = Set(normalized.device_scale_factor);
        active_model.touch_points = Set(normalized.touch_points as i32);
        active_model.custom_platform = Set(normalized.custom_platform);
        active_model.arch = Set(normalized.arch);
        active_model.bitness = Set(normalized.bitness);
        active_model.mobile = Set(normalized.mobile);
        active_model.form_factor = Set(normalized.form_factor);
        active_model.user_agent_template = Set(normalized.user_agent_template);
        active_model.custom_gl_vendor = Set(normalized.custom_gl_vendor);
        active_model.custom_gl_renderer = Set(normalized.custom_gl_renderer);
        active_model.custom_cpu_cores = Set(normalized.custom_cpu_cores as i32);
        active_model.custom_ram_gb = Set(normalized.custom_ram_gb as i32);
        active_model.browser_version = Set(normalized.browser_version);
        active_model.updated_at = Set(now_ts());

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(to_api_preset(&updated))
    }

    pub fn resolve_preset(
        &self,
        platform: &str,
        preset_id: Option<&str>,
    ) -> AppResult<FingerprintPresetSpec> {
        self.ensure_seeded()?;
        let normalized_platform = fingerprint_catalog::normalize_platform(Some(platform))
            .ok_or_else(|| AppError::Validation("fingerprint platform is required".to_string()))?;
        if let Some(preset_id) = preset_id.and_then(trim_to_option) {
            if let Some(model) = self.find_preset_by_key(&preset_id)? {
                if model.platform != normalized_platform {
                    return Err(AppError::Validation(format!(
                        "fingerprint preset {preset_id} does not match platform {normalized_platform}"
                    )));
                }
                return Ok(to_preset_spec(&model));
            }
            return Err(AppError::Validation(format!(
                "fingerprint preset not found: {preset_id}"
            )));
        }

        if let Some(model) = self.db_query(
            device_preset::Entity::find()
                .filter(device_preset::Column::Platform.eq(normalized_platform))
                .order_by_asc(device_preset::Column::CreatedAt)
                .one(&self.db),
        )? {
            return Ok(to_preset_spec(&model));
        }

        Err(AppError::Validation(format!(
            "no fingerprint preset for platform {normalized_platform}"
        )))
    }

    pub fn get_preset_spec_by_key(&self, preset_id: &str) -> Option<FingerprintPresetSpec> {
        self.find_preset_by_key(preset_id)
            .ok()
            .flatten()
            .map(|model| to_preset_spec(&model))
    }

    fn find_preset_model(&self, preset_id: &str) -> AppResult<device_preset::Model> {
        self.find_preset_by_key(preset_id)?
            .ok_or_else(|| AppError::NotFound(format!("device preset not found: {preset_id}")))
    }

    fn find_preset_by_key(&self, preset_id: &str) -> AppResult<Option<device_preset::Model>> {
        self.db_query(
            device_preset::Entity::find()
                .filter(device_preset::Column::PresetKey.eq(preset_id))
                .one(&self.db),
        )
    }

    fn ensure_seeded(&self) -> AppResult<()> {
        let now = now_ts();
        for preset in fingerprint_catalog::builtin_preset_definitions(None) {
            if let Some(existing) = self.find_preset_by_key(&preset.id)? {
                if preset.id == BUILTIN_MACOS_PRESET_ID
                    && existing.platform_version != preset.platform_version
                {
                    let mut active_model: device_preset::ActiveModel = existing.into();
                    active_model.platform_version = Set(preset.platform_version.clone());
                    active_model.updated_at = Set(now);
                    self.db_query(active_model.update(&self.db))?;
                }
                continue;
            }
            let primary_variant = preset.variants.first().cloned().ok_or_else(|| {
                AppError::Validation(format!("fingerprint preset {} has no variant", preset.id))
            })?;
            let active_model = device_preset::ActiveModel {
                preset_key: Set(preset.id.clone()),
                label: Set(preset.label),
                platform: Set(preset.platform),
                platform_version: Set(preset.platform_version),
                viewport_width: Set(preset.viewport_width as i32),
                viewport_height: Set(preset.viewport_height as i32),
                device_scale_factor: Set(preset.device_scale_factor),
                touch_points: Set(preset.touch_points.unwrap_or(0) as i32),
                custom_platform: Set(preset.custom_platform),
                arch: Set(preset.arch),
                bitness: Set(preset.bitness),
                mobile: Set(preset.mobile),
                form_factor: Set(preset.form_factor),
                user_agent_template: Set(primary_variant.user_agent_template),
                custom_gl_vendor: Set(primary_variant.gl_vendor),
                custom_gl_renderer: Set(primary_variant.gl_renderer),
                custom_cpu_cores: Set(primary_variant.custom_cpu_cores as i32),
                custom_ram_gb: Set(primary_variant
                    .custom_ram_gb
                    .min(fingerprint_catalog::MAX_FINGERPRINT_RAM_GB)
                    as i32),
                browser_version: Set(preset.browser_version.clone()),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            self.db_query(device_preset::Entity::insert(active_model).exec(&self.db))?;
        }

        Ok(())
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }
}

#[derive(Debug)]
struct NormalizedPresetPayload {
    label: String,
    platform: String,
    platform_version: String,
    viewport_width: u32,
    viewport_height: u32,
    device_scale_factor: f32,
    touch_points: u32,
    custom_platform: String,
    arch: String,
    bitness: String,
    mobile: bool,
    form_factor: String,
    user_agent_template: String,
    custom_gl_vendor: String,
    custom_gl_renderer: String,
    custom_cpu_cores: u32,
    custom_ram_gb: u32,
    browser_version: String,
}

fn normalize_payload(
    payload: SaveProfileDevicePresetRequest,
) -> AppResult<NormalizedPresetPayload> {
    let label = trim_owned(payload.label)
        .ok_or_else(|| AppError::Validation("device preset label is required".to_string()))?;
    let platform = fingerprint_catalog::normalize_platform(Some(&payload.platform))
        .ok_or_else(|| AppError::Validation("device preset platform is invalid".to_string()))?
        .to_string();
    let platform_version = trim_owned(payload.platform_version).ok_or_else(|| {
        AppError::Validation("device preset platformVersion is required".to_string())
    })?;
    let custom_platform = trim_owned(payload.custom_platform).ok_or_else(|| {
        AppError::Validation("device preset customPlatform is required".to_string())
    })?;
    let arch = trim_owned(payload.arch)
        .ok_or_else(|| AppError::Validation("device preset arch is required".to_string()))?;
    let bitness = trim_owned(payload.bitness)
        .ok_or_else(|| AppError::Validation("device preset bitness is required".to_string()))?;
    let form_factor = trim_owned(payload.form_factor)
        .ok_or_else(|| AppError::Validation("device preset formFactor is required".to_string()))?;
    let user_agent_template = trim_owned(payload.user_agent_template).ok_or_else(|| {
        AppError::Validation("device preset userAgentTemplate is required".to_string())
    })?;
    if !user_agent_template.contains("{version}") {
        return Err(AppError::Validation(
            "device preset userAgentTemplate must contain {version}".to_string(),
        ));
    }
    let custom_gl_vendor = trim_owned(payload.custom_gl_vendor).ok_or_else(|| {
        AppError::Validation("device preset customGlVendor is required".to_string())
    })?;
    let custom_gl_renderer = trim_owned(payload.custom_gl_renderer).ok_or_else(|| {
        AppError::Validation("device preset customGlRenderer is required".to_string())
    })?;
    if payload.viewport_width == 0 || payload.viewport_height == 0 {
        return Err(AppError::Validation(
            "device preset viewport must be greater than 0".to_string(),
        ));
    }
    if payload.device_scale_factor <= 0.0 {
        return Err(AppError::Validation(
            "device preset dpr must be greater than 0".to_string(),
        ));
    }
    if payload.custom_cpu_cores == 0 {
        return Err(AppError::Validation(
            "device preset cpu cores must be greater than 0".to_string(),
        ));
    }
    if payload.custom_ram_gb == 0 {
        return Err(AppError::Validation(
            "device preset ram gb must be greater than 0".to_string(),
        ));
    }
    let browser_version = trim_owned(payload.browser_version).ok_or_else(|| {
        AppError::Validation("device preset browserVersion is required".to_string())
    })?;
    // Validate version is in the platform catalog; unknown versions are still stored but warned.
    let normalized_platform_str = fingerprint_catalog::normalize_platform(Some(&platform))
        .unwrap_or("macos");
    if !crate::chromium_version_catalog::contains(normalized_platform_str, &browser_version) {
        crate::logger::warn(
            "device_preset",
            format!(
                "browser_version '{}' not in catalog for platform '{}'",
                browser_version, normalized_platform_str
            ),
        );
    }

    Ok(NormalizedPresetPayload {
        label,
        platform,
        platform_version,
        viewport_width: payload.viewport_width,
        viewport_height: payload.viewport_height,
        device_scale_factor: payload.device_scale_factor,
        touch_points: payload.touch_points,
        custom_platform,
        arch,
        bitness,
        mobile: payload.mobile,
        form_factor,
        user_agent_template,
        custom_gl_vendor,
        custom_gl_renderer,
        custom_cpu_cores: payload.custom_cpu_cores,
        custom_ram_gb: payload
            .custom_ram_gb
            .min(fingerprint_catalog::MAX_FINGERPRINT_RAM_GB),
        browser_version,
    })
}

fn to_api_preset(model: &device_preset::Model) -> ProfileDevicePreset {
    ProfileDevicePreset {
        id: model.preset_key.clone(),
        label: model.label.clone(),
        platform: model.platform.clone(),
        platform_version: model.platform_version.clone(),
        viewport_width: model.viewport_width.max(0) as u32,
        viewport_height: model.viewport_height.max(0) as u32,
        device_scale_factor: model.device_scale_factor,
        touch_points: model.touch_points.max(0) as u32,
        custom_platform: model.custom_platform.clone(),
        arch: model.arch.clone(),
        bitness: model.bitness.clone(),
        mobile: model.mobile,
        form_factor: model.form_factor.clone(),
        user_agent_template: model.user_agent_template.clone(),
        custom_gl_vendor: model.custom_gl_vendor.clone(),
        custom_gl_renderer: model.custom_gl_renderer.clone(),
        custom_cpu_cores: model.custom_cpu_cores.max(1) as u32,
        custom_ram_gb: model.custom_ram_gb.max(1) as u32,
        browser_version: model.browser_version.clone(),
        is_builtin: is_builtin_preset_key(&model.preset_key),
    }
}

fn to_preset_spec(model: &device_preset::Model) -> FingerprintPresetSpec {
    FingerprintPresetSpec {
        id: model.preset_key.clone(),
        label: model.label.clone(),
        platform: model.platform.clone(),
        platform_version: model.platform_version.clone(),
        viewport_width: model.viewport_width.max(0) as u32,
        viewport_height: model.viewport_height.max(0) as u32,
        device_scale_factor: model.device_scale_factor,
        touch_points: Some(model.touch_points.max(0) as u32),
        custom_platform: model.custom_platform.clone(),
        arch: model.arch.clone(),
        bitness: model.bitness.clone(),
        mobile: model.mobile,
        form_factor: model.form_factor.clone(),
        browser_version: model.browser_version.clone(),
        variants: vec![FingerprintVariantSpec {
            user_agent_template: model.user_agent_template.clone(),
            gl_vendor: model.custom_gl_vendor.clone(),
            gl_renderer: model.custom_gl_renderer.clone(),
            custom_cpu_cores: model.custom_cpu_cores.max(1) as u32,
            custom_ram_gb: model.custom_ram_gb.max(1) as u32,
        }],
    }
}

fn trim_owned(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn trim_to_option(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn generate_preset_key() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("custom_dp_{millis}")
}

fn is_builtin_preset_key(preset_id: &str) -> bool {
    fingerprint_catalog::builtin_preset_definitions(None)
        .iter()
        .any(|preset| preset.id == preset_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn get_preset_returns_saved_entry() {
        let db = db::init_test_database().expect("init test db");
        let service = DevicePresetService::from_db(db);
        let preset = service
            .create_preset(SaveProfileDevicePresetRequest {
                label: "Android Lab".to_string(),
                platform: "android".to_string(),
                platform_version: "15.0.0".to_string(),
                viewport_width: 412,
                viewport_height: 915,
                device_scale_factor: 2.75,
                touch_points: 5,
                custom_platform: "Linux armv81".to_string(),
                arch: "arm".to_string(),
                bitness: "64".to_string(),
                mobile: true,
                form_factor: "Mobile".to_string(),
                user_agent_template:
                    "Mozilla/5.0 (Linux; Android 15; Android Lab) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36"
                        .to_string(),
                custom_gl_vendor: "Qualcomm".to_string(),
                custom_gl_renderer: "Adreno 750".to_string(),
                custom_cpu_cores: 8,
                custom_ram_gb: 8,
                browser_version: "148.0.7778.49".to_string(),
            })
            .expect("create preset");

        let stored = service.get_preset(&preset.id).expect("get preset");

        assert_eq!(stored.id, preset.id);
        assert_eq!(stored.label, "Android Lab");
        assert_eq!(stored.platform, "android");
    }

    #[test]
    fn get_preset_returns_not_found_for_unknown_id() {
        let db = db::init_test_database().expect("init test db");
        let service = DevicePresetService::from_db(db);

        let err = service
            .get_preset("missing_preset_id")
            .expect_err("missing preset should fail");

        assert!(
            matches!(err, AppError::NotFound(ref message) if message.contains("missing_preset_id")),
            "unexpected error: {err:?}"
        );
    }

    #[test]
    fn list_presets_includes_custom_entries() {
        let db = db::init_test_database().expect("init test db");
        let service = DevicePresetService::from_db(db);
        service
            .create_preset(SaveProfileDevicePresetRequest {
                label: "Custom Pixel".to_string(),
                platform: "android".to_string(),
                platform_version: "14.0.0".to_string(),
                viewport_width: 430,
                viewport_height: 932,
                device_scale_factor: 3.0,
                touch_points: 5,
                custom_platform: "Linux armv81".to_string(),
                arch: "arm".to_string(),
                bitness: "64".to_string(),
                mobile: true,
                form_factor: "Mobile".to_string(),
                user_agent_template:
                    "Mozilla/5.0 (Linux; Android 14; Custom Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36"
                        .to_string(),
                custom_gl_vendor: "Qualcomm".to_string(),
                custom_gl_renderer: "Adreno".to_string(),
                custom_cpu_cores: 8,
                custom_ram_gb: 12,
                browser_version: "148.0.7778.49".to_string(),
            })
            .expect("create preset");

        let items = service
            .list_presets(Some("android"), None)
            .expect("list presets");

        assert!(items.iter().any(|item| item.id == "android_pixel_8"));
        assert!(items.iter().any(|item| item.label == "Custom Pixel"));
    }

    #[test]
    fn builtin_macos_preset_is_readonly_and_uses_reduced_platform_version() {
        let db = db::init_test_database().expect("init test db");
        let service = DevicePresetService::from_db(db);

        let preset = service
            .get_preset("macos_macbook_pro_14")
            .expect("get builtin macos preset");

        assert_eq!(preset.platform_version, "10.15.7");
        assert_eq!(preset.is_builtin, true);

        let update_err = service
            .update_preset(
                "macos_macbook_pro_14",
                SaveProfileDevicePresetRequest {
                    label: "Edited Mac".to_string(),
                    platform: "macos".to_string(),
                    platform_version: "10.15.7".to_string(),
                    viewport_width: 1512,
                    viewport_height: 982,
                    device_scale_factor: 2.0,
                    touch_points: 0,
                    custom_platform: "MacIntel".to_string(),
                    arch: "arm".to_string(),
                    bitness: "64".to_string(),
                    mobile: false,
                    form_factor: "Desktop".to_string(),
                    user_agent_template:
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36"
                            .to_string(),
                    custom_gl_vendor: "Google Inc. (Apple)".to_string(),
                    custom_gl_renderer:
                        "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)"
                            .to_string(),
                    custom_cpu_cores: 8,
                    custom_ram_gb: 8,
                    browser_version: "147.0.7727.117".to_string(),
                },
            )
            .expect_err("builtin update should fail");
        assert!(matches!(update_err, AppError::Validation(_)));

        let delete_err = service
            .delete_preset("macos_macbook_pro_14")
            .expect_err("builtin delete should fail");
        assert!(matches!(delete_err, AppError::Validation(_)));
    }

    #[test]
    fn resolve_custom_preset_returns_custom_snapshot_source() {
        let db = db::init_test_database().expect("init test db");
        let service = DevicePresetService::from_db(db);
        let preset = service
            .create_preset(SaveProfileDevicePresetRequest {
                label: "Windows Lab".to_string(),
                platform: "windows".to_string(),
                platform_version: "10.0.0".to_string(),
                viewport_width: 1600,
                viewport_height: 900,
                device_scale_factor: 1.25,
                touch_points: 0,
                custom_platform: "Win32".to_string(),
                arch: "x86".to_string(),
                bitness: "64".to_string(),
                mobile: false,
                form_factor: "Desktop".to_string(),
                user_agent_template:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36"
                        .to_string(),
                custom_gl_vendor: "Google Inc. (Intel)".to_string(),
                custom_gl_renderer: "ANGLE (Intel Iris Xe)".to_string(),
                custom_cpu_cores: 8,
                custom_ram_gb: 16,
                browser_version: "147.0.7727.117".to_string(),
            })
            .expect("create preset");

        let resolved = service
            .resolve_preset("windows", Some(&preset.id))
            .expect("resolve preset");

        assert_eq!(resolved.label, "Windows Lab");
        assert_eq!(resolved.platform, "windows");
        assert_eq!(resolved.variants.len(), 1);
    }
}
