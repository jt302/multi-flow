use crate::error::{AppError, AppResult};
use crate::font_catalog;
use crate::models::{
    FingerprintSeedPolicy, FingerprintStrategy, ProfileDevicePreset, ProfileFingerprintSnapshot,
    ProfileFingerprintSource,
};

pub const FINGERPRINT_CATALOG_VERSION: &str = "2026.03.08";
pub const DEFAULT_BROWSER_VERSION: &str = "144.0.7559.97";
pub const MAX_FINGERPRINT_RAM_GB: u32 = 8;

#[derive(Debug, Clone)]
pub struct FingerprintVariantSpec {
    pub user_agent_template: String,
    pub gl_vendor: String,
    pub gl_renderer: String,
    pub custom_cpu_cores: u32,
    pub custom_ram_gb: u32,
}

#[derive(Debug, Clone)]
pub struct FingerprintPresetSpec {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub platform_version: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub device_scale_factor: f32,
    pub touch_points: Option<u32>,
    pub custom_platform: String,
    pub arch: String,
    pub bitness: String,
    pub mobile: bool,
    pub form_factor: String,
    pub variants: Vec<FingerprintVariantSpec>,
}

#[derive(Debug, Clone, Copy)]
struct FingerprintVariant {
    user_agent_template: &'static str,
    gl_vendor: &'static str,
    gl_renderer: &'static str,
    custom_cpu_cores: u32,
    custom_ram_gb: u32,
}

#[derive(Debug, Clone, Copy)]
struct PresetDefinition {
    id: &'static str,
    label: &'static str,
    platform: &'static str,
    platform_version: &'static str,
    viewport_width: u32,
    viewport_height: u32,
    device_scale_factor: f32,
    touch_points: Option<u32>,
    custom_platform: &'static str,
    arch: &'static str,
    bitness: &'static str,
    mobile: bool,
    form_factor: &'static str,
    variants: &'static [FingerprintVariant],
}

const MACOS_MACBOOK_PRO_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "Apple",
        gl_renderer: "Apple M3",
        custom_cpu_cores: 8,
        custom_ram_gb: 18,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "Apple",
        gl_renderer: "Apple M2 Pro",
        custom_cpu_cores: 10,
        custom_ram_gb: 16,
    },
];

const WINDOWS_DESKTOP_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "Google Inc. (NVIDIA)",
        gl_renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
        custom_cpu_cores: 12,
        custom_ram_gb: 32,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "Google Inc. (Intel)",
        gl_renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)",
        custom_cpu_cores: 8,
        custom_ram_gb: 16,
    },
];

const LINUX_DESKTOP_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "Intel",
        gl_renderer: "Mesa Intel(R) UHD Graphics 770",
        custom_cpu_cores: 8,
        custom_ram_gb: 16,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36",
        gl_vendor: "NVIDIA Corporation",
        gl_renderer: "NVIDIA GeForce RTX 3070/PCIe/SSE2",
        custom_cpu_cores: 12,
        custom_ram_gb: 32,
    },
];

const ANDROID_PIXEL_8_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
        gl_vendor: "ARM",
        gl_renderer: "Mali-G715",
        custom_cpu_cores: 8,
        custom_ram_gb: 8,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
        gl_vendor: "Google",
        gl_renderer: "Google Tensor G3 GPU",
        custom_cpu_cores: 8,
        custom_ram_gb: 12,
    },
];

const ANDROID_S24_ULTRA_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
        gl_vendor: "Qualcomm",
        gl_renderer: "Adreno (TM) 750",
        custom_cpu_cores: 8,
        custom_ram_gb: 12,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (Linux; Android 14; SM-S9280) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
        gl_vendor: "Qualcomm",
        gl_renderer: "Adreno (TM) 750",
        custom_cpu_cores: 8,
        custom_ram_gb: 16,
    },
];

const IOS_IPHONE_15_PRO_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple A17 Pro GPU",
        custom_cpu_cores: 6,
        custom_ram_gb: 8,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple A17 Pro GPU",
        custom_cpu_cores: 6,
        custom_ram_gb: 8,
    },
];

const IOS_IPHONE_15_PRO_MAX_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple A17 Pro GPU",
        custom_cpu_cores: 6,
        custom_ram_gb: 8,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple A17 Pro GPU",
        custom_cpu_cores: 6,
        custom_ram_gb: 8,
    },
];

const IOS_IPAD_AIR_VARIANTS: &[FingerprintVariant] = &[
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple M2 GPU",
        custom_cpu_cores: 8,
        custom_ram_gb: 8,
    },
    FingerprintVariant {
        user_agent_template:
            "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
        gl_vendor: "Apple",
        gl_renderer: "Apple M2 GPU",
        custom_cpu_cores: 8,
        custom_ram_gb: 8,
    },
];

const PRESETS: &[PresetDefinition] = &[
    PresetDefinition {
        id: "macos_macbook_pro_14",
        label: "MacBook Pro 14",
        platform: "macos",
        platform_version: "14.0.0",
        viewport_width: 1512,
        viewport_height: 982,
        device_scale_factor: 2.0,
        touch_points: None,
        custom_platform: "MacIntel",
        arch: "arm",
        bitness: "64",
        mobile: false,
        form_factor: "Desktop",
        variants: MACOS_MACBOOK_PRO_VARIANTS,
    },
    PresetDefinition {
        id: "windows_11_desktop",
        label: "Windows 11 Desktop",
        platform: "windows",
        platform_version: "10.0.0",
        viewport_width: 1536,
        viewport_height: 864,
        device_scale_factor: 1.25,
        touch_points: None,
        custom_platform: "Win32",
        arch: "x86",
        bitness: "64",
        mobile: false,
        form_factor: "Desktop",
        variants: WINDOWS_DESKTOP_VARIANTS,
    },
    PresetDefinition {
        id: "linux_ubuntu_desktop",
        label: "Ubuntu Desktop",
        platform: "linux",
        platform_version: "24.04.0",
        viewport_width: 1440,
        viewport_height: 900,
        device_scale_factor: 1.0,
        touch_points: None,
        custom_platform: "Linux x86_64",
        arch: "x86",
        bitness: "64",
        mobile: false,
        form_factor: "Desktop",
        variants: LINUX_DESKTOP_VARIANTS,
    },
    PresetDefinition {
        id: "android_pixel_8",
        label: "Pixel 8",
        platform: "android",
        platform_version: "14.0.0",
        viewport_width: 412,
        viewport_height: 915,
        device_scale_factor: 2.625,
        touch_points: Some(5),
        custom_platform: "Linux armv81",
        arch: "arm",
        bitness: "64",
        mobile: true,
        form_factor: "Mobile",
        variants: ANDROID_PIXEL_8_VARIANTS,
    },
    PresetDefinition {
        id: "android_s24_ultra",
        label: "Galaxy S24 Ultra",
        platform: "android",
        platform_version: "14.0.0",
        viewport_width: 412,
        viewport_height: 915,
        device_scale_factor: 3.5,
        touch_points: Some(5),
        custom_platform: "Linux armv81",
        arch: "arm",
        bitness: "64",
        mobile: true,
        form_factor: "Mobile",
        variants: ANDROID_S24_ULTRA_VARIANTS,
    },
    PresetDefinition {
        id: "ios_iphone_15_pro",
        label: "iPhone 15 Pro",
        platform: "ios",
        platform_version: "17.0.0",
        viewport_width: 393,
        viewport_height: 852,
        device_scale_factor: 3.0,
        touch_points: Some(5),
        custom_platform: "iPhone",
        arch: "arm",
        bitness: "64",
        mobile: true,
        form_factor: "Mobile",
        variants: IOS_IPHONE_15_PRO_VARIANTS,
    },
    PresetDefinition {
        id: "ios_iphone_15_pro_max",
        label: "iPhone 15 Pro Max",
        platform: "ios",
        platform_version: "17.0.0",
        viewport_width: 430,
        viewport_height: 932,
        device_scale_factor: 3.0,
        touch_points: Some(5),
        custom_platform: "iPhone",
        arch: "arm",
        bitness: "64",
        mobile: true,
        form_factor: "Mobile",
        variants: IOS_IPHONE_15_PRO_MAX_VARIANTS,
    },
    PresetDefinition {
        id: "ios_ipad_air",
        label: "iPad Air",
        platform: "ios",
        platform_version: "17.0.0",
        viewport_width: 820,
        viewport_height: 1180,
        device_scale_factor: 2.0,
        touch_points: Some(5),
        custom_platform: "iPad",
        arch: "arm",
        bitness: "64",
        mobile: true,
        form_factor: "Tablet",
        variants: IOS_IPAD_AIR_VARIANTS,
    },
];

#[cfg(test)]
pub fn catalog_version() -> &'static str {
    FINGERPRINT_CATALOG_VERSION
}

pub fn default_browser_version() -> &'static str {
    DEFAULT_BROWSER_VERSION
}

pub fn normalize_platform(platform: Option<&str>) -> Option<&'static str> {
    let value = platform
        .map(|item| item.trim().to_ascii_lowercase())
        .unwrap_or_default();
    if value.is_empty() {
        return None;
    }
    if value.contains("mac") {
        return Some("macos");
    }
    if value.contains("win") {
        return Some("windows");
    }
    if value.contains("linux") {
        return Some("linux");
    }
    if value.contains("android") {
        return Some("android");
    }
    if value.contains("ios") || value.contains("iphone") || value.contains("ipad") {
        return Some("ios");
    }
    None
}

pub fn builtin_preset_definitions(platform: Option<&str>) -> Vec<FingerprintPresetSpec> {
    let normalized = normalize_platform(platform);
    PRESETS
        .iter()
        .filter(|preset| {
            normalized
                .map(|value| value == preset.platform)
                .unwrap_or(true)
        })
        .map(to_owned_preset)
        .collect()
}

fn to_owned_preset(preset: &PresetDefinition) -> FingerprintPresetSpec {
    FingerprintPresetSpec {
        id: preset.id.to_string(),
        label: preset.label.to_string(),
        platform: preset.platform.to_string(),
        platform_version: preset.platform_version.to_string(),
        viewport_width: preset.viewport_width,
        viewport_height: preset.viewport_height,
        device_scale_factor: preset.device_scale_factor,
        touch_points: preset.touch_points,
        custom_platform: preset.custom_platform.to_string(),
        arch: preset.arch.to_string(),
        bitness: preset.bitness.to_string(),
        mobile: preset.mobile,
        form_factor: preset.form_factor.to_string(),
        variants: preset
            .variants
            .iter()
            .map(|variant| FingerprintVariantSpec {
                user_agent_template: variant.user_agent_template.to_string(),
                gl_vendor: variant.gl_vendor.to_string(),
                gl_renderer: variant.gl_renderer.to_string(),
                custom_cpu_cores: variant.custom_cpu_cores,
                custom_ram_gb: variant.custom_ram_gb,
            })
            .collect(),
    }
}

pub fn preset_to_device_preset(preset: &FingerprintPresetSpec) -> ProfileDevicePreset {
    let primary_variant = preset
        .variants
        .first()
        .cloned()
        .unwrap_or(FingerprintVariantSpec {
            user_agent_template: String::new(),
            gl_vendor: String::new(),
            gl_renderer: String::new(),
            custom_cpu_cores: 1,
            custom_ram_gb: 1,
        });
    ProfileDevicePreset {
        id: preset.id.clone(),
        label: preset.label.clone(),
        platform: preset.platform.clone(),
        platform_version: preset.platform_version.clone(),
        viewport_width: preset.viewport_width,
        viewport_height: preset.viewport_height,
        device_scale_factor: preset.device_scale_factor,
        touch_points: preset.touch_points.unwrap_or(0),
        custom_platform: preset.custom_platform.clone(),
        arch: preset.arch.clone(),
        bitness: preset.bitness.clone(),
        mobile: preset.mobile,
        form_factor: preset.form_factor.clone(),
        user_agent_template: primary_variant.user_agent_template,
        custom_gl_vendor: primary_variant.gl_vendor,
        custom_gl_renderer: primary_variant.gl_renderer,
        custom_cpu_cores: primary_variant.custom_cpu_cores,
        custom_ram_gb: primary_variant.custom_ram_gb.min(MAX_FINGERPRINT_RAM_GB),
    }
}

#[allow(dead_code)]
pub fn list_fingerprint_presets(
    platform: Option<&str>,
    _browser_version: Option<&str>,
) -> Vec<ProfileDevicePreset> {
    builtin_preset_definitions(platform)
        .into_iter()
        .map(|preset| preset_to_device_preset(&preset))
        .collect()
}

pub fn default_preset_for_platform(platform: &str) -> Option<String> {
    builtin_preset_definitions(Some(platform))
        .into_iter()
        .next()
        .map(|preset| preset.id)
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn resolve_fingerprint_snapshot(
    source: &ProfileFingerprintSource,
    language_override: Option<&str>,
    timezone_override: Option<&str>,
    fingerprint_seed: Option<u32>,
) -> AppResult<ProfileFingerprintSnapshot> {
    let platform = normalize_platform(source.platform.as_deref())
        .ok_or_else(|| AppError::Validation("fingerprint platform is required".to_string()))?;
    let preset = resolve_preset(platform, source.device_preset_id.as_deref())?;
    resolve_fingerprint_snapshot_from_preset(
        &preset,
        source,
        language_override,
        timezone_override,
        fingerprint_seed,
    )
}

pub fn resolve_fingerprint_snapshot_from_preset(
    preset: &FingerprintPresetSpec,
    source: &ProfileFingerprintSource,
    language_override: Option<&str>,
    timezone_override: Option<&str>,
    fingerprint_seed: Option<u32>,
) -> AppResult<ProfileFingerprintSnapshot> {
    let version = source
        .browser_version
        .as_deref()
        .and_then(trim_to_option)
        .unwrap_or_else(|| DEFAULT_BROWSER_VERSION.to_string());
    let strategy = source
        .strategy
        .clone()
        .unwrap_or(FingerprintStrategy::Template);
    let variant = resolve_variant(preset, &version, fingerprint_seed, strategy);
    let language = language_override.and_then(trim_to_option);
    let time_zone = timezone_override.and_then(trim_to_option);

    Ok(ProfileFingerprintSnapshot {
        browser_version: Some(version.clone()),
        platform: Some(preset.platform.clone()),
        platform_version: Some(preset.platform_version.clone()),
        preset_label: Some(preset.label.clone()),
        form_factor: Some(preset.form_factor.clone()),
        mobile: Some(preset.mobile),
        user_agent: Some(
            variant
                .user_agent_template
                .replace("{version}", version.trim()),
        ),
        custom_ua_metadata: Some(build_ua_metadata(preset, version.trim())),
        custom_platform: Some(preset.custom_platform.clone()),
        custom_cpu_cores: Some(variant.custom_cpu_cores),
        custom_ram_gb: Some(variant.custom_ram_gb.min(MAX_FINGERPRINT_RAM_GB)),
        custom_gl_vendor: Some(variant.gl_vendor.clone()),
        custom_gl_renderer: Some(variant.gl_renderer.clone()),
        custom_touch_points: preset.touch_points,
        custom_font_list: Some(font_catalog::list_fonts_for_platform(Some(
            &preset.platform,
        ))),
        language: language.clone(),
        accept_languages: language.as_deref().map(build_accept_languages),
        time_zone,
        window_width: Some(preset.viewport_width),
        window_height: Some(preset.viewport_height),
        device_scale_factor: Some(preset.device_scale_factor),
        fingerprint_seed: resolve_seed_value(
            source.seed_policy.clone(),
            strategy,
            fingerprint_seed,
        ),
    })
}

pub fn normalize_source(
    source: Option<&ProfileFingerprintSource>,
    platform: Option<&str>,
    browser_version: Option<&str>,
    device_preset_id: Option<&str>,
    random_fingerprint: bool,
) -> ProfileFingerprintSource {
    let normalized_platform =
        normalize_platform(platform.or_else(|| source.and_then(|value| value.platform.as_deref())))
            .unwrap_or("macos");
    let preset_id = device_preset_id
        .and_then(trim_to_option)
        .or_else(|| {
            source
                .and_then(|value| value.device_preset_id.as_deref())
                .and_then(trim_to_option)
        })
        .or_else(|| default_preset_for_platform(normalized_platform))
        .unwrap_or_else(|| normalized_platform.to_string());
    let version = browser_version
        .and_then(trim_to_option)
        .or_else(|| {
            source
                .and_then(|value| value.browser_version.as_deref())
                .and_then(trim_to_option)
        })
        .unwrap_or_else(|| DEFAULT_BROWSER_VERSION.to_string());
    let strategy = if random_fingerprint {
        FingerprintStrategy::RandomBundle
    } else {
        FingerprintStrategy::Template
    };
    let seed_policy = if random_fingerprint {
        FingerprintSeedPolicy::PerLaunch
    } else {
        FingerprintSeedPolicy::Fixed
    };

    ProfileFingerprintSource {
        platform: Some(normalized_platform.to_string()),
        device_preset_id: Some(preset_id),
        browser_version: Some(version),
        strategy: Some(strategy),
        seed_policy: Some(seed_policy),
        catalog_version: Some(FINGERPRINT_CATALOG_VERSION.to_string()),
    }
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_preset(
    platform: &str,
    device_preset_id: Option<&str>,
) -> AppResult<FingerprintPresetSpec> {
    let presets = builtin_preset_definitions(Some(platform));
    if let Some(preset_id) = device_preset_id.and_then(trim_to_option) {
        if let Some(preset) = presets.into_iter().find(|item| item.id == preset_id) {
            if preset.platform != platform {
                return Err(AppError::Validation(format!(
                    "fingerprint preset {preset_id} does not match platform {platform}"
                )));
            }
            return Ok(preset);
        }
        return Err(AppError::Validation(format!(
            "fingerprint preset not found: {preset_id}"
        )));
    }

    builtin_preset_definitions(Some(platform))
        .into_iter()
        .find(|item| item.platform == platform)
        .ok_or_else(|| {
            AppError::Validation(format!("no fingerprint preset for platform {platform}"))
        })
}

fn resolve_variant(
    preset: &FingerprintPresetSpec,
    version: &str,
    fingerprint_seed: Option<u32>,
    strategy: FingerprintStrategy,
) -> FingerprintVariantSpec {
    if preset.variants.len() <= 1 || matches!(strategy, FingerprintStrategy::Template) {
        return preset.variants[0].clone();
    }

    let seed = fingerprint_seed.unwrap_or_else(|| stable_seed(&(preset.id.clone() + version)));
    let index = (seed as usize) % preset.variants.len();
    preset.variants[index].clone()
}

fn resolve_seed_value(
    seed_policy: Option<FingerprintSeedPolicy>,
    strategy: FingerprintStrategy,
    fingerprint_seed: Option<u32>,
) -> Option<u32> {
    match seed_policy.unwrap_or_else(|| match strategy {
        FingerprintStrategy::Template => FingerprintSeedPolicy::Fixed,
        FingerprintStrategy::RandomBundle => FingerprintSeedPolicy::PerLaunch,
    }) {
        FingerprintSeedPolicy::Fixed => fingerprint_seed,
        FingerprintSeedPolicy::PerLaunch => fingerprint_seed,
    }
}

fn build_ua_metadata(preset: &FingerprintPresetSpec, version: &str) -> String {
    let chrome_major = version
        .split('.')
        .next()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("144");
    format!(
        "platform={}|platform_version={}|arch={}|bitness={}|mobile={}|brands=Google Chrome:{},Chromium:{}|form_factors={}",
        render_metadata_platform(&preset.platform),
        preset.platform_version,
        preset.arch,
        preset.bitness,
        if preset.mobile { "1" } else { "0" },
        chrome_major,
        chrome_major,
        preset.form_factor,
    )
}

fn render_metadata_platform(platform: &str) -> &'static str {
    match platform {
        "macos" => "macOS",
        "windows" => "Windows",
        "linux" => "Linux",
        "android" => "Android",
        "ios" => "iOS",
        _ => "Unknown",
    }
}

fn build_accept_languages(language: &str) -> String {
    let primary = language.trim();
    if primary.is_empty() {
        return String::new();
    }
    let base = primary.split('-').next().unwrap_or(primary).trim();
    if base.eq_ignore_ascii_case(primary) {
        format!("{primary},en;q=0.8")
    } else {
        format!("{primary},{base};q=0.9,en;q=0.8")
    }
}

/// 把预设派生字段合并到已有快照，只更新与预设直接关联的字段。
/// 明确保留：fingerprint_seed / language / accept_languages / time_zone / custom_font_list。
pub fn merge_preset_into_snapshot(
    snapshot: &mut ProfileFingerprintSnapshot,
    preset: &FingerprintPresetSpec,
    browser_version: &str,
    fingerprint_seed: Option<u32>,
) {
    let version = browser_version.trim();
    let version = if version.is_empty() {
        DEFAULT_BROWSER_VERSION
    } else {
        version
    };
    let variant = resolve_variant(preset, version, fingerprint_seed, FingerprintStrategy::Template);

    snapshot.preset_label = Some(preset.label.clone());
    snapshot.platform = Some(preset.platform.clone());
    snapshot.platform_version = Some(preset.platform_version.clone());
    snapshot.custom_platform = Some(preset.custom_platform.clone());
    snapshot.form_factor = Some(preset.form_factor.clone());
    snapshot.mobile = Some(preset.mobile);
    snapshot.user_agent = Some(variant.user_agent_template.replace("{version}", version));
    snapshot.custom_ua_metadata = Some(build_ua_metadata(preset, version));
    snapshot.custom_gl_vendor = Some(variant.gl_vendor.clone());
    snapshot.custom_gl_renderer = Some(variant.gl_renderer.clone());
    snapshot.custom_cpu_cores = Some(variant.custom_cpu_cores);
    snapshot.custom_ram_gb = Some(variant.custom_ram_gb.min(MAX_FINGERPRINT_RAM_GB));
    snapshot.custom_touch_points = preset.touch_points;
    snapshot.window_width = Some(preset.viewport_width);
    snapshot.window_height = Some(preset.viewport_height);
    snapshot.device_scale_factor = Some(preset.device_scale_factor);
    // fingerprint_seed / language / accept_languages / time_zone / custom_font_list 不碰
}

fn trim_to_option(input: &str) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn stable_seed(seed_hint: &str) -> u32 {
    use std::hash::{Hash, Hasher};

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    seed_hint.hash(&mut hasher);
    (hasher.finish() & u64::from(u32::MAX)) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{FingerprintSeedPolicy, FingerprintStrategy, ProfileFingerprintSource};

    #[test]
    fn random_bundle_keeps_platform_consistent() {
        let source = ProfileFingerprintSource {
            platform: Some("android".to_string()),
            device_preset_id: Some("android_pixel_8".to_string()),
            browser_version: Some("144.0.7559.97".to_string()),
            strategy: Some(FingerprintStrategy::RandomBundle),
            seed_policy: Some(FingerprintSeedPolicy::PerLaunch),
            catalog_version: Some(catalog_version().to_string()),
        };

        let snapshot = resolve_fingerprint_snapshot(&source, Some("en-US"), None, Some(42))
            .expect("resolve snapshot");

        assert_eq!(snapshot.platform.as_deref(), Some("android"));
        assert_eq!(snapshot.form_factor.as_deref(), Some("Mobile"));
        assert!(snapshot
            .user_agent
            .as_deref()
            .is_some_and(|value| value.contains("Android")));
        assert!(snapshot
            .custom_font_list
            .as_ref()
            .is_some_and(|items| items.iter().any(|item| item == "Roboto")));
    }

    #[test]
    fn merge_preset_into_snapshot_updates_preset_fields() {
        let source = ProfileFingerprintSource {
            platform: Some("macos".to_string()),
            device_preset_id: Some("macos_macbook_pro_14".to_string()),
            browser_version: Some("144.0.7559.97".to_string()),
            strategy: Some(FingerprintStrategy::Template),
            seed_policy: Some(FingerprintSeedPolicy::Fixed),
            catalog_version: None,
        };
        let mut snapshot =
            resolve_fingerprint_snapshot(&source, Some("zh-CN"), Some("Asia/Shanghai"), Some(12345))
                .expect("initial snapshot");

        assert_eq!(snapshot.fingerprint_seed, Some(12345));
        assert_eq!(snapshot.language.as_deref(), Some("zh-CN"));
        assert_eq!(snapshot.time_zone.as_deref(), Some("Asia/Shanghai"));

        // 构造一个修改了 GL 信息的新预设 spec（不走 DB，直接手造）
        let modified_preset = FingerprintPresetSpec {
            id: "macos_macbook_pro_14".to_string(),
            label: "MacBook Pro 14 Custom".to_string(),
            platform: "macos".to_string(),
            platform_version: "15.0.0".to_string(),
            viewport_width: 1512,
            viewport_height: 982,
            device_scale_factor: 2.0,
            touch_points: None,
            custom_platform: "MacIntel".to_string(),
            arch: "arm".to_string(),
            bitness: "64".to_string(),
            mobile: false,
            form_factor: "Desktop".to_string(),
            variants: vec![FingerprintVariantSpec {
                user_agent_template:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 Chrome/{version} Safari/537.36".to_string(),
                gl_vendor: "Google Inc. (Apple)".to_string(),
                gl_renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M3)".to_string(),
                custom_cpu_cores: 10,
                custom_ram_gb: 8,
            }],
        };

        merge_preset_into_snapshot(&mut snapshot, &modified_preset, "144.0.7559.97", Some(12345));

        // 预设派生字段应已更新
        assert_eq!(snapshot.custom_gl_vendor.as_deref(), Some("Google Inc. (Apple)"));
        assert_eq!(snapshot.custom_gl_renderer.as_deref(), Some("ANGLE (Apple, ANGLE Metal Renderer: Apple M3)"));
        assert_eq!(snapshot.platform_version.as_deref(), Some("15.0.0"));
        assert_eq!(snapshot.preset_label.as_deref(), Some("MacBook Pro 14 Custom"));
        assert_eq!(snapshot.custom_cpu_cores, Some(10));

        // 不属于预设管辖的字段必须保留原值
        assert_eq!(snapshot.fingerprint_seed, Some(12345), "fingerprint_seed 不能被修改");
        assert_eq!(snapshot.language.as_deref(), Some("zh-CN"), "language 不能被修改");
        assert_eq!(snapshot.time_zone.as_deref(), Some("Asia/Shanghai"), "time_zone 不能被修改");
    }
}
