use std::collections::HashSet;

use crate::error::{AppError, AppResult};
use crate::models::FontListMode;

#[allow(dead_code)]
mod raw {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../resources/fonts.rs"
    ));
}

#[allow(dead_code)]
mod mobile {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../resources/mobile_system_fonts.rs"
    ));
}

#[allow(dead_code)]
mod linux {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../resources/linux_system_fonts.rs"
    ));
}

fn dedupe_fonts(items: impl IntoIterator<Item = &'static str>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for item in items {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            continue;
        }
        let key = trimmed.to_ascii_lowercase();
        if seen.insert(key) {
            result.push(trimmed.to_string());
        }
    }
    result
}

pub fn list_fonts_for_platform(platform: Option<&str>) -> Vec<String> {
    let platform = platform
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default();

    if platform.contains("android") {
        return dedupe_fonts(
            mobile::ANDROID_AOSP_FAMILY_NAMES
                .iter()
                .copied()
                .chain(mobile::MOBILE_SYSTEM_FONTS.iter().copied()),
        );
    }
    if platform.contains("ios") || platform.contains("iphone") || platform.contains("ipad") {
        return dedupe_fonts(
            mobile::IOS_APPLE_MISSING_SUPPLEMENTS
                .iter()
                .copied()
                .chain(mobile::MOBILE_SYSTEM_FONTS.iter().copied()),
        );
    }
    if platform.contains("mac") {
        return dedupe_fonts(
            raw::FONTS_CROSS_PLATFORM
                .iter()
                .copied()
                .chain(raw::FONTS_MAC_ONLY.iter().copied()),
        );
    }
    if platform.contains("win") {
        return dedupe_fonts(
            raw::FONTS_CROSS_PLATFORM
                .iter()
                .copied()
                .chain(raw::FONTS_WINDOWS_ONLY.iter().copied()),
        );
    }
    if platform.contains("linux") {
        return dedupe_fonts(
            linux::LINUX_GENERIC_ALIASES
                .iter()
                .copied()
                .chain(linux::LINUX_OFFICIAL_SUPPLEMENTS.iter().copied())
                .chain(linux::LINUX_REUSED_FROM_UPLOADED.iter().copied()),
        );
    }

    dedupe_fonts(raw::ALL_FONTS.iter().copied())
}

pub fn resolve_fonts_for_mode(
    platform: Option<&str>,
    mode: FontListMode,
    custom_fonts: Option<&Vec<String>>,
    seed: Option<u32>,
) -> AppResult<Vec<String>> {
    match mode {
        FontListMode::Preset => Ok(list_fonts_for_platform(platform)),
        FontListMode::Custom => {
            let fonts = custom_fonts
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|item| {
                    let trimmed = item.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed.to_string())
                    }
                })
                .collect::<Vec<_>>();
            if fonts.is_empty() {
                return Err(AppError::Validation(
                    "custom font list mode requires at least one font".to_string(),
                ));
            }
            Ok(dedupe_owned_fonts(fonts))
        }
        FontListMode::Random => {
            let pool = list_fonts_for_platform(platform);
            if pool.is_empty() {
                return Ok(pool);
            }
            Ok(randomized_font_subset(pool, seed))
        }
    }
}

fn dedupe_owned_fonts(items: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for item in items {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            continue;
        }
        let key = trimmed.to_ascii_lowercase();
        if seen.insert(key) {
            result.push(trimmed.to_string());
        }
    }
    result
}

fn randomized_font_subset(pool: Vec<String>, seed: Option<u32>) -> Vec<String> {
    if pool.len() <= 8 {
        return pool;
    }
    let mut keyed = pool
        .into_iter()
        .enumerate()
        .map(|(index, value)| {
            let key = stable_seed(&(seed.unwrap_or(0), index as u32, value.to_ascii_lowercase()));
            (key, value)
        })
        .collect::<Vec<_>>();
    keyed.sort_by_key(|(key, _)| *key);

    let len = keyed.len();
    let ratio_basis = (seed.unwrap_or_else(|| stable_seed(&(len as u32, 17u32))) % 21) as usize;
    let keep_ratio = 70 + ratio_basis;
    let target_count = ((len * keep_ratio) / 100).clamp(48, len);

    keyed
        .into_iter()
        .take(target_count)
        .map(|(_, value)| value)
        .collect()
}

fn stable_seed<T: std::hash::Hash>(seed_hint: &T) -> u32 {
    use std::hash::Hasher;

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    seed_hint.hash(&mut hasher);
    (hasher.finish() & u64::from(u32::MAX)) as u32
}
