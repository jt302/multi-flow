use serde::Serialize;

#[derive(Debug, Clone, Copy)]
pub struct DevicePresetDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub platform: &'static str,
    pub platform_version: &'static str,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub device_scale_factor: f32,
    pub touch_points: u32,
    pub user_agents: &'static [&'static str],
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePresetSummary {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub platform_version: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub device_scale_factor: f32,
    pub touch_points: u32,
}

const ANDROID_PIXEL_8: DevicePresetDefinition = DevicePresetDefinition {
    id: "android_pixel_8",
    label: "Pixel 8",
    platform: "android",
    platform_version: "14.0.0",
    viewport_width: 412,
    viewport_height: 915,
    device_scale_factor: 2.625,
    touch_points: 5,
    user_agents: &[
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
    ],
};

const ANDROID_S24_ULTRA: DevicePresetDefinition = DevicePresetDefinition {
    id: "android_s24_ultra",
    label: "Galaxy S24 Ultra",
    platform: "android",
    platform_version: "14.0.0",
    viewport_width: 412,
    viewport_height: 915,
    device_scale_factor: 3.5,
    touch_points: 5,
    user_agents: &[
        "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
    ],
};

const IOS_IPHONE_15_PRO: DevicePresetDefinition = DevicePresetDefinition {
    id: "ios_iphone_15_pro",
    label: "iPhone 15 Pro",
    platform: "ios",
    platform_version: "17.0.0",
    viewport_width: 393,
    viewport_height: 852,
    device_scale_factor: 3.0,
    touch_points: 5,
    user_agents: &[
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
    ],
};

const IOS_IPHONE_15_PRO_MAX: DevicePresetDefinition = DevicePresetDefinition {
    id: "ios_iphone_15_pro_max",
    label: "iPhone 15 Pro Max",
    platform: "ios",
    platform_version: "17.0.0",
    viewport_width: 430,
    viewport_height: 932,
    device_scale_factor: 3.0,
    touch_points: 5,
    user_agents: &[
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
    ],
};

const IOS_IPAD_AIR: DevicePresetDefinition = DevicePresetDefinition {
    id: "ios_ipad_air",
    label: "iPad Air",
    platform: "ios",
    platform_version: "17.0.0",
    viewport_width: 820,
    viewport_height: 1180,
    device_scale_factor: 2.0,
    touch_points: 5,
    user_agents: &[
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version} Mobile/15E148 Safari/604.1",
    ],
};

const PRESETS: &[DevicePresetDefinition] = &[
    ANDROID_PIXEL_8,
    ANDROID_S24_ULTRA,
    IOS_IPHONE_15_PRO,
    IOS_IPHONE_15_PRO_MAX,
    IOS_IPAD_AIR,
];

pub fn list_device_presets(platform: Option<&str>) -> Vec<DevicePresetSummary> {
    let platform = platform
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default();

    PRESETS
        .iter()
        .filter(|item| {
            platform.is_empty()
                || item.platform == platform
                || (platform == "iphone" && item.platform == "ios")
                || (platform == "ipad" && item.platform == "ios")
        })
        .map(to_summary)
        .collect()
}

pub fn get_device_preset(id: &str) -> Option<&'static DevicePresetDefinition> {
    PRESETS.iter().find(|item| item.id == id.trim())
}

pub fn render_user_agent(preset: &DevicePresetDefinition, version_hint: &str) -> String {
    let version = version_hint.trim();
    let resolved_version = if version.is_empty() {
        "144.0.7559.97"
    } else {
        version
    };
    let template = preset.user_agents.first().copied().unwrap_or(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36",
    );
    template.replace("{version}", resolved_version)
}

fn to_summary(item: &DevicePresetDefinition) -> DevicePresetSummary {
    DevicePresetSummary {
        id: item.id.to_string(),
        label: item.label.to_string(),
        platform: item.platform.to_string(),
        platform_version: item.platform_version.to_string(),
        viewport_width: item.viewport_width,
        viewport_height: item.viewport_height,
        device_scale_factor: item.device_scale_factor,
        touch_points: item.touch_points,
    }
}
