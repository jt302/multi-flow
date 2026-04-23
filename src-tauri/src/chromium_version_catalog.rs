use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromiumVersionEntry {
    pub major: u32,
    pub version: &'static str,
    pub release_date: &'static str,
}

// ── macOS ────────────────────────────────────────────────────────────────────
// Source: chromiumdash.appspot.com/fetch_releases?platform=Mac&channel=Stable
// One entry per major (latest stable patch), sorted newest first.
pub const MACOS_VERSIONS: &[ChromiumVersionEntry] = &[
    ChromiumVersionEntry { major: 147, version: "147.0.7727.117", release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 146, version: "146.0.7680.180", release_date: "2026-04-07" },
    ChromiumVersionEntry { major: 145, version: "145.0.7632.162", release_date: "2026-03-10" },
    ChromiumVersionEntry { major: 144, version: "144.0.7559.135", release_date: "2026-02-13" },
    ChromiumVersionEntry { major: 143, version: "143.0.7499.194", release_date: "2026-01-07" },
    ChromiumVersionEntry { major: 142, version: "142.0.7444.177", release_date: "2025-11-19" },
    ChromiumVersionEntry { major: 141, version: "141.0.7390.124", release_date: "2025-10-22" },
    ChromiumVersionEntry { major: 140, version: "140.0.7339.215", release_date: "2025-09-30" },
    ChromiumVersionEntry { major: 139, version: "139.0.7258.157", release_date: "2025-09-03" },
    ChromiumVersionEntry { major: 138, version: "138.0.7204.185", release_date: "2025-07-29" },
];

// ── Windows ──────────────────────────────────────────────────────────────────
// Source: chromiumdash.appspot.com/fetch_releases?platform=Windows&channel=Stable
pub const WINDOWS_VERSIONS: &[ChromiumVersionEntry] = &[
    ChromiumVersionEntry { major: 147, version: "147.0.7727.117", release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 146, version: "146.0.7680.180", release_date: "2026-04-07" },
    ChromiumVersionEntry { major: 145, version: "145.0.7632.162", release_date: "2026-03-10" },
    ChromiumVersionEntry { major: 144, version: "144.0.7559.135", release_date: "2026-02-13" },
    ChromiumVersionEntry { major: 143, version: "143.0.7499.194", release_date: "2026-01-07" },
    ChromiumVersionEntry { major: 142, version: "142.0.7444.177", release_date: "2025-11-19" },
    ChromiumVersionEntry { major: 141, version: "141.0.7390.125", release_date: "2025-10-28" },
    ChromiumVersionEntry { major: 140, version: "140.0.7339.210", release_date: "2025-09-30" },
    ChromiumVersionEntry { major: 139, version: "139.0.7258.157", release_date: "2025-09-03" },
    ChromiumVersionEntry { major: 138, version: "138.0.7204.185", release_date: "2025-07-29" },
];

// ── Linux ────────────────────────────────────────────────────────────────────
// Source: chromiumdash.appspot.com/fetch_releases?platform=Linux&channel=Stable
pub const LINUX_VERSIONS: &[ChromiumVersionEntry] = &[
    ChromiumVersionEntry { major: 147, version: "147.0.7727.116", release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 146, version: "146.0.7680.177", release_date: "2026-03-31" },
    ChromiumVersionEntry { major: 145, version: "145.0.7632.159", release_date: "2026-03-03" },
    ChromiumVersionEntry { major: 144, version: "144.0.7559.132", release_date: "2026-02-03" },
    ChromiumVersionEntry { major: 143, version: "143.0.7499.192", release_date: "2026-01-06" },
    ChromiumVersionEntry { major: 142, version: "142.0.7444.175", release_date: "2025-11-17" },
    ChromiumVersionEntry { major: 141, version: "141.0.7390.122", release_date: "2025-10-21" },
    ChromiumVersionEntry { major: 140, version: "140.0.7339.207", release_date: "2025-09-23" },
    ChromiumVersionEntry { major: 139, version: "139.0.7258.154", release_date: "2025-08-25" },
    ChromiumVersionEntry { major: 138, version: "138.0.7204.183", release_date: "2025-07-28" },
];

// ── Android ──────────────────────────────────────────────────────────────────
// Source: chromiumdash.appspot.com/fetch_releases?platform=Android&channel=Stable
pub const ANDROID_VERSIONS: &[ChromiumVersionEntry] = &[
    ChromiumVersionEntry { major: 148, version: "148.0.7778.49",  release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 147, version: "147.0.7727.111", release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 146, version: "146.0.7680.178", release_date: "2026-04-01" },
    ChromiumVersionEntry { major: 145, version: "145.0.7632.161", release_date: "2026-03-10" },
    ChromiumVersionEntry { major: 144, version: "144.0.7559.133", release_date: "2026-02-04" },
    ChromiumVersionEntry { major: 143, version: "143.0.7499.194", release_date: "2026-01-14" },
    ChromiumVersionEntry { major: 142, version: "142.0.7444.173", release_date: "2025-12-02" },
    ChromiumVersionEntry { major: 141, version: "141.0.7390.123", release_date: "2025-10-22" },
    ChromiumVersionEntry { major: 140, version: "140.0.7339.208", release_date: "2025-09-24" },
    ChromiumVersionEntry { major: 139, version: "139.0.7258.160", release_date: "2025-09-02" },
];

// ── iOS ──────────────────────────────────────────────────────────────────────
// Source: chromiumdash.appspot.com/fetch_releases?platform=iOS&channel=Stable
pub const IOS_VERSIONS: &[ChromiumVersionEntry] = &[
    ChromiumVersionEntry { major: 148, version: "148.0.7778.47",  release_date: "2026-04-22" },
    ChromiumVersionEntry { major: 147, version: "147.0.7727.99",  release_date: "2026-04-14" },
    ChromiumVersionEntry { major: 146, version: "146.0.7680.151", release_date: "2026-03-16" },
    ChromiumVersionEntry { major: 145, version: "145.0.7632.108", release_date: "2026-02-18" },
    ChromiumVersionEntry { major: 144, version: "144.0.7559.95",  release_date: "2026-01-20" },
    ChromiumVersionEntry { major: 143, version: "143.0.7499.151", release_date: "2025-12-16" },
    ChromiumVersionEntry { major: 142, version: "142.0.7444.148", release_date: "2025-11-10" },
    ChromiumVersionEntry { major: 141, version: "141.0.7390.96",  release_date: "2025-10-14" },
    ChromiumVersionEntry { major: 140, version: "140.0.7339.122", release_date: "2025-09-08" },
    ChromiumVersionEntry { major: 139, version: "139.0.7258.76",  release_date: "2025-08-04" },
];

pub fn versions_for(platform: &str) -> &'static [ChromiumVersionEntry] {
    match platform.to_ascii_lowercase().as_str() {
        "macos" => MACOS_VERSIONS,
        "windows" => WINDOWS_VERSIONS,
        "linux" => LINUX_VERSIONS,
        "android" => ANDROID_VERSIONS,
        "ios" => IOS_VERSIONS,
        _ => MACOS_VERSIONS,
    }
}

pub fn latest_for(platform: &str) -> &'static ChromiumVersionEntry {
    let list = versions_for(platform);
    &list[0]
}

pub fn contains(platform: &str, version: &str) -> bool {
    versions_for(platform).iter().any(|e| e.version == version)
}
