use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::time::Duration;

use reqwest::Client;
use reqwest::Url;
use tauri::{AppHandle, Manager, State};

use crate::engine_manager::EngineLaunchOptions;
use crate::error::AppError;
use crate::fingerprint_catalog;
use crate::font_catalog;
use crate::logger;
use crate::models::{
    BatchProfileActionItem, BatchProfileActionRequest, BatchProfileActionResponse,
    BatchSetProfileGroupRequest, ClearProfileCacheResponse, CookieStateFile, CreateProfileRequest,
    CustomValueMode, ExportProfileCookiesMode, ExportProfileCookiesRequest,
    ExportProfileCookiesResponse, ExtensionStateFile, FontListMode, GeolocationMode,
    GeolocationOverride, ListProfilesQuery, ListProfilesResponse, LocalApiServerStatus,
    ManagedCookie, ManagedExtension, OpenProfileOptions, OpenProfileResponse, Profile,
    ProfileDevicePreset, ProfileFingerprintSnapshot, ProfileFingerprintSource,
    ProfilePluginSelection, ProfileRuntimeDetails, ProfileSettings, Proxy,
    ReadProfileCookiesResponse, SaveProfileDevicePresetRequest, SetProfileGroupRequest,
    UpdateDevicePresetOutcome, UpdateProfileVisualRequest, WebRtcMode,
};
use crate::runtime_guard;
use crate::services::device_preset_service::DevicePresetService;
use crate::services::proxy_service::lookup_geoip_geolocation;
use crate::state::AppState;

const PUBLIC_IP_LOOKUP_TIMEOUT_SECS: u64 = 5;
const PUBLIC_IP_LOOKUP_URLS: &[&str] = &[
    "https://api.ipify.org?format=json",
    "https://api64.ipify.org?format=json",
    "https://api.ip.sb/ip",
    "https://ifconfig.me/ip",
];

#[derive(serde::Deserialize)]
struct PublicIpResponse {
    ip: Option<String>,
}

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    payload: CreateProfileRequest,
) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!(
            "create_profile request name={} group={:?} has_settings={}",
            payload.name,
            payload.group,
            payload.settings.is_some()
        ),
    );
    let requested_proxy_id = payload.proxy_id.clone();
    validate_plugin_selections_from_settings(&state, payload.settings.as_ref())?;
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let created = profile_service
        .create_profile(payload)
        .map_err(error_to_string)?;
    drop(profile_service);

    let profile = if let Some(proxy_id) = requested_proxy_id {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service
            .bind_profile_proxy(&created.id, &proxy_id)
            .map_err(error_to_string)?;
        drop(proxy_service);
        refresh_profile_locale_for_bound_proxy(&state, &created.id, &proxy_id)?
    } else {
        refresh_profile_locale_for_unbound_profile(&state, &created.id)?
    };
    sync_profile_cookie_state_from_settings_quietly(&state, &profile.id, profile.settings.as_ref());
    sync_profile_extension_state_from_settings_quietly(
        &state,
        &profile.id,
        profile.settings.as_ref(),
    );

    logger::info(
        "profile_cmd",
        format!("create_profile success profile_id={}", profile.id),
    );
    Ok(profile)
}

#[tauri::command]
pub fn duplicate_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!("duplicate_profile request profile_id={profile_id}"),
    );

    // 1. 获取源 profile
    let (source, proxy_id) = {
        let ps = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        let source = ps.get_profile(&profile_id).map_err(error_to_string)?;
        drop(ps);

        // 获取源 profile 的代理绑定
        let proxy_id = {
            let px = state
                .proxy_service
                .lock()
                .map_err(|_| "proxy service lock poisoned".to_string())?;
            px.get_profile_proxy(&profile_id)
                .ok()
                .flatten()
                .map(|p| p.id.clone())
        };
        (source, proxy_id)
    };

    // 2. 生成不重复的副本名称
    let copy_name = {
        let ps = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        let all = ps
            .list_profiles(ListProfilesQuery {
                include_deleted: false,
                page: 1,
                page_size: 100000,
                keyword: None,
                group: None,
                running: None,
            })
            .map_err(error_to_string)?;
        let existing_names: std::collections::HashSet<String> =
            all.items.iter().map(|p| p.name.clone()).collect();

        let base = source.name.clone();
        let mut idx = 1u32;
        loop {
            let candidate = format!("{base} - 副本{idx}");
            if !existing_names.contains(&candidate) {
                break candidate;
            }
            idx += 1;
        }
    };

    // 3. 复用 create_profile 完整流程
    let payload = CreateProfileRequest {
        name: copy_name,
        group: source.group.clone(),
        note: source.note.clone(),
        proxy_id,
        settings: source.settings.clone(),
    };
    let created = create_profile(state, payload)?;

    logger::info(
        "profile_cmd",
        format!("duplicate_profile success new_id={}", created.id),
    );
    Ok(created)
}

#[tauri::command]
pub async fn list_profiles(
    app: AppHandle,
    include_deleted: Option<bool>,
    page: Option<u64>,
    page_size: Option<u64>,
    keyword: Option<String>,
    group: Option<String>,
    running: Option<bool>,
) -> Result<ListProfilesResponse, String> {
    let query = ListProfilesQuery {
        include_deleted: include_deleted.unwrap_or(false),
        page: page.unwrap_or(1),
        page_size: page_size.unwrap_or(50),
        keyword,
        group,
        running,
    };

    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let profile_service = state.lock_profile_service();
        profile_service
            .list_profiles(query)
            .map_err(error_to_string)
    })
    .await
    .map_err(|err| format!("list profiles task join failed: {err}"))?
}

#[tauri::command]
pub async fn open_profile(
    app: AppHandle,
    profile_id: String,
    options: Option<OpenProfileOptions>,
    task_id: Option<String>,
) -> Result<OpenProfileResponse, String> {
    logger::info(
        "profile_cmd",
        format!(
            "open_profile request profile_id={profile_id} has_options={}",
            options.is_some()
        ),
    );
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        do_open_profile(&state, Some(&app), task_id.as_deref(), &profile_id, options)
    })
    .await
    .map_err(|err| format!("open profile task join failed: {err}"))?
}

#[tauri::command]
pub fn close_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!("close_profile request profile_id={profile_id}"),
    );
    do_close_profile(&state, &profile_id)
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    do_delete_profile(&state, &profile_id)
}

#[tauri::command]
pub fn restore_profile(state: State<'_, AppState>, profile_id: String) -> Result<Profile, String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_service
        .restore_profile(&profile_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn purge_profile(state: State<'_, AppState>, profile_id: String) -> Result<(), String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_service
        .purge_profile(&profile_id)
        .map_err(error_to_string)?;
    Ok(())
}

#[tauri::command]
pub fn update_profile(
    state: State<'_, AppState>,
    profile_id: String,
    payload: CreateProfileRequest,
) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!(
            "update_profile request profile_id={profile_id} name={} has_settings={}",
            payload.name,
            payload.settings.is_some()
        ),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let existing = profile_service
        .get_profile(&profile_id)
        .map_err(error_to_string)?;
    if existing.running {
        return Err(
            "validation failed: profile is running, only visual identifier settings can be changed at runtime"
                .to_string(),
        );
    }
    validate_plugin_selections_from_settings(&state, payload.settings.as_ref())?;
    let _updated = profile_service
        .update_profile(&profile_id, payload.clone())
        .map_err(error_to_string)?;
    drop(profile_service);

    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    let updated = if let Some(proxy_id) = payload.proxy_id {
        if proxy_id.trim().is_empty() {
            unbind_profile_proxy_if_exists(&proxy_service, &profile_id)?;
            drop(proxy_service);
            refresh_profile_locale_for_unbound_profile(&state, &profile_id)?
        } else {
            proxy_service
                .bind_profile_proxy(&profile_id, &proxy_id)
                .map_err(error_to_string)?;
            drop(proxy_service);
            refresh_profile_locale_for_bound_proxy(&state, &profile_id, &proxy_id)?
        }
    } else {
        unbind_profile_proxy_if_exists(&proxy_service, &profile_id)?;
        drop(proxy_service);
        refresh_profile_locale_for_unbound_profile(&state, &profile_id)?
    };
    sync_profile_cookie_state_from_settings_quietly(&state, &updated.id, updated.settings.as_ref());
    sync_profile_extension_state_from_settings_quietly(
        &state,
        &updated.id,
        updated.settings.as_ref(),
    );
    Ok(updated)
}

#[tauri::command]
pub fn update_profile_visual(
    state: State<'_, AppState>,
    profile_id: String,
    payload: UpdateProfileVisualRequest,
) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!(
            "update_profile_visual request profile_id={profile_id} bg_mode={:?} bg={:?} label_mode={:?}",
            payload.browser_bg_color_mode, payload.browser_bg_color, payload.toolbar_label_mode
        ),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let profile = profile_service
        .update_profile_visual(
            &profile_id,
            payload.browser_bg_color_mode,
            payload.browser_bg_color.clone(),
            payload.toolbar_label_mode,
        )
        .map_err(error_to_string)?;
    drop(profile_service);

    if profile.running {
        let engine_manager = state
            .engine_manager
            .lock()
            .map_err(|_| "engine manager lock poisoned".to_string())?;
        engine_manager
            .apply_profile_visual_overrides(
                &profile_id,
                profile.resolved_browser_bg_color.clone(),
                profile.resolved_toolbar_text.clone(),
            )
            .map_err(error_to_string)?;
    }

    Ok(profile)
}

#[tauri::command]
pub fn get_profile_runtime_details(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileRuntimeDetails, String> {
    build_profile_runtime_details(&state, &profile_id)
}

#[tauri::command]
pub fn clear_profile_cache(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ClearProfileCacheResponse, String> {
    clear_profile_cache_inner(&state, &profile_id)
}

#[tauri::command]
pub fn read_profile_cookies(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ReadProfileCookiesResponse, String> {
    runtime_guard::reconcile_runtime_state(&state).map_err(error_to_string)?;
    read_profile_cookies_inner(&state, &profile_id)
}

#[tauri::command]
pub fn export_profile_cookies(
    state: State<'_, AppState>,
    profile_id: String,
    payload: ExportProfileCookiesRequest,
) -> Result<ExportProfileCookiesResponse, String> {
    runtime_guard::reconcile_runtime_state(&state).map_err(error_to_string)?;
    export_profile_cookies_inner(&state, &profile_id, payload)
}

fn clear_profile_cache_inner(
    state: &AppState,
    profile_id: &str,
) -> Result<ClearProfileCacheResponse, String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let profile = profile_service
        .get_profile(profile_id)
        .map_err(error_to_string)?;
    if profile.running {
        return Err("运行中的环境不能清理 cache，请先关闭环境".to_string());
    }
    drop(profile_service);

    let (_, _, cache_data_dir) = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?
        .profile_data_dirs(profile_id)
        .map_err(error_to_string)?;

    if cache_data_dir.exists() {
        fs::remove_dir_all(&cache_data_dir).map_err(|err| err.to_string())?;
    }
    fs::create_dir_all(&cache_data_dir).map_err(|err| err.to_string())?;

    Ok(ClearProfileCacheResponse {
        profile_id: profile_id.to_string(),
        cache_data_dir: cache_data_dir.to_string_lossy().to_string(),
    })
}

fn read_profile_cookies_inner(
    state: &AppState,
    profile_id: &str,
) -> Result<ReadProfileCookiesResponse, String> {
    let profile = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?
        .get_profile(profile_id)
        .map_err(error_to_string)?;
    let cookie_state = {
        let engine_manager = state
            .engine_manager
            .lock()
            .map_err(|_| "engine manager lock poisoned".to_string())?;
        load_profile_cookie_state_from_storage(
            profile_id,
            profile.settings.as_ref(),
            &engine_manager,
        )?
        .unwrap_or_else(|| empty_cookie_state(profile_id))
    };
    let json = serde_json::to_string_pretty(&cookie_state)
        .map_err(|err| format!("serialize cookie state failed: {err}"))?;
    Ok(ReadProfileCookiesResponse {
        json: format!("{json}\n"),
        cookie_count: cookie_state.managed_cookies.len(),
        site_urls: collect_cookie_site_urls(&cookie_state),
    })
}

fn export_profile_cookies_inner(
    state: &AppState,
    profile_id: &str,
    payload: ExportProfileCookiesRequest,
) -> Result<ExportProfileCookiesResponse, String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let profile = profile_service
        .get_profile(profile_id)
        .map_err(error_to_string)?;
    drop(profile_service);

    let export_mode = payload.mode;
    let export_url = match export_mode {
        ExportProfileCookiesMode::All => None,
        ExportProfileCookiesMode::Site => Some(
            payload
                .url
                .as_deref()
                .and_then(trim_str_to_option)
                .ok_or_else(|| "按站点导出时必须选择 URL".to_string())?,
        ),
    };
    let export_path = payload
        .export_path
        .as_deref()
        .and_then(trim_str_to_option)
        .ok_or_else(|| "导出 Cookie 时必须选择保存路径".to_string())?;
    let cookie_state = {
        let engine_manager = state
            .engine_manager
            .lock()
            .map_err(|_| "engine manager lock poisoned".to_string())?;
        load_profile_cookie_state_from_storage(
            profile_id,
            profile.settings.as_ref(),
            &engine_manager,
        )?
        .unwrap_or_else(|| empty_cookie_state(profile_id))
    };
    let export_cookie_state = match export_mode {
        ExportProfileCookiesMode::All => cookie_state,
        ExportProfileCookiesMode::Site => {
            filter_cookie_state_by_site_label(&cookie_state, &export_url.expect("site export url"))?
        }
    };
    if export_cookie_state.managed_cookies.is_empty() {
        return Err("当前环境没有可导出的 Cookie".to_string());
    }

    let file_path = PathBuf::from(export_path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("create cookie export directory failed: {err}"))?;
    }
    let content = serde_json::to_string_pretty(&export_cookie_state)
        .map_err(|err| format!("serialize cookie export failed: {err}"))?;
    fs::write(&file_path, format!("{content}\n"))
        .map_err(|err| format!("write cookie export file failed: {err}"))?;

    Ok(ExportProfileCookiesResponse {
        path: file_path.to_string_lossy().to_string(),
        cookie_count: export_cookie_state.managed_cookies.len(),
    })
}

fn prepare_cookie_state_file(
    profile_id: &str,
    settings: Option<&ProfileSettings>,
    engine_manager: &crate::engine_manager::EngineManager,
) -> Result<Option<PathBuf>, String> {
    let cookie_state =
        load_profile_cookie_state_from_storage(profile_id, settings, engine_manager)?;
    let Some(cookie_state) = cookie_state else {
        return Ok(None);
    };
    let path = resolve_profile_cookie_state_path(engine_manager, profile_id)?;
    if !path.exists() {
        write_cookie_state_file(
            path.parent()
                .ok_or_else(|| "resolve cookie directory failed".to_string())?,
            &cookie_state,
        )?;
    }
    Ok(Some(path))
}

fn prepare_extension_state_file(
    state: &AppState,
    profile_id: &str,
    settings: Option<&ProfileSettings>,
    engine_manager: &crate::engine_manager::EngineManager,
) -> Result<Option<PathBuf>, String> {
    let extension_state =
        load_profile_extension_state_from_storage(state, profile_id, settings, engine_manager)?;
    let Some(extension_state) = extension_state else {
        return Ok(None);
    };
    if extension_state.managed_extensions.is_empty() {
        return Ok(None);
    }
    let path = resolve_profile_extension_state_path(engine_manager, profile_id)?;
    if !path.exists() {
        write_extension_state_file(
            path.parent()
                .ok_or_else(|| "resolve extension directory failed".to_string())?,
            &extension_state,
        )?;
    }
    Ok(Some(path))
}

fn resolve_profile_cookie_state_path(
    engine_manager: &crate::engine_manager::EngineManager,
    profile_id: &str,
) -> Result<PathBuf, String> {
    Ok(engine_manager
        .profile_data_dirs(profile_id)
        .map_err(error_to_string)?
        .0
        .join("cookies")
        .join("cookie-state.json"))
}

fn resolve_profile_extension_state_path(
    engine_manager: &crate::engine_manager::EngineManager,
    profile_id: &str,
) -> Result<PathBuf, String> {
    Ok(engine_manager
        .profile_data_dirs(profile_id)
        .map_err(error_to_string)?
        .0
        .join("extensions")
        .join("extension-state.json"))
}

fn empty_cookie_state(profile_id: &str) -> CookieStateFile {
    CookieStateFile {
        environment_id: Some(profile_id.to_string()),
        managed_cookies: Vec::new(),
    }
}

fn load_profile_cookie_state_from_storage(
    profile_id: &str,
    settings: Option<&ProfileSettings>,
    engine_manager: &crate::engine_manager::EngineManager,
) -> Result<Option<CookieStateFile>, String> {
    let path = resolve_profile_cookie_state_path(engine_manager, profile_id)?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("read cookie state file failed: {err}"))?;
        let mut cookie_state = parse_cookie_state_json(&content)?;
        if cookie_state
            .environment_id
            .as_deref()
            .and_then(trim_str_to_option)
            .is_none()
        {
            cookie_state.environment_id = Some(profile_id.to_string());
            write_cookie_state_file(
                path.parent()
                    .ok_or_else(|| "resolve cookie directory failed".to_string())?,
                &cookie_state,
            )?;
        }
        return Ok(Some(cookie_state));
    }

    let cookie_state_json = settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.cookie_state_json.as_deref())
        .and_then(trim_str_to_option);
    let Some(cookie_state_json) = cookie_state_json else {
        return Ok(None);
    };
    let mut cookie_state = parse_cookie_state_json(&cookie_state_json)?;
    if cookie_state
        .environment_id
        .as_deref()
        .and_then(trim_str_to_option)
        .is_none()
    {
        cookie_state.environment_id = Some(profile_id.to_string());
    }
    write_cookie_state_file(
        path.parent()
            .ok_or_else(|| "resolve cookie directory failed".to_string())?,
        &cookie_state,
    )?;
    Ok(Some(cookie_state))
}

fn load_profile_extension_state_from_storage(
    state: &AppState,
    profile_id: &str,
    settings: Option<&ProfileSettings>,
    engine_manager: &crate::engine_manager::EngineManager,
) -> Result<Option<ExtensionStateFile>, String> {
    let path = resolve_profile_extension_state_path(engine_manager, profile_id)?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("read extension state file failed: {err}"))?;
        let mut extension_state = parse_extension_state_json(&content)?;
        if extension_state
            .environment_id
            .as_deref()
            .and_then(trim_str_to_option)
            .is_none()
        {
            extension_state.environment_id = Some(profile_id.to_string());
            write_extension_state_file(
                path.parent()
                    .ok_or_else(|| "resolve extension directory failed".to_string())?,
                &extension_state,
            )?;
        }
        return Ok(Some(extension_state));
    }

    let selections = settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.plugin_selections.as_ref())
        .cloned()
        .unwrap_or_default();
    if selections.is_empty() {
        return Ok(None);
    }
    let extension_state = build_extension_state_from_selections(state, profile_id, &selections)?;
    write_extension_state_file(
        path.parent()
            .ok_or_else(|| "resolve extension directory failed".to_string())?,
        &extension_state,
    )?;
    Ok(Some(extension_state))
}

fn parse_cookie_state_json(value: &str) -> Result<CookieStateFile, String> {
    let parsed = serde_json::from_str::<CookieStateFile>(value)
        .map_err(|err| format!("cookieStateJson must be valid JSON: {err}"))?;
    for cookie in &parsed.managed_cookies {
        validate_managed_cookie(cookie)?;
    }
    Ok(parsed)
}

fn parse_extension_state_json(value: &str) -> Result<ExtensionStateFile, String> {
    let parsed = serde_json::from_str::<ExtensionStateFile>(value)
        .map_err(|err| format!("extensionStateJson must be valid JSON: {err}"))?;
    for extension in &parsed.managed_extensions {
        validate_managed_extension(extension)?;
    }
    Ok(parsed)
}

fn validate_managed_cookie(cookie: &ManagedCookie) -> Result<(), String> {
    if cookie.cookie_id.trim().is_empty()
        || cookie.url.trim().is_empty()
        || cookie.name.trim().is_empty()
    {
        return Err(
            "cookieStateJson must include cookie_id, url, name, value for each cookie".to_string(),
        );
    }
    let parsed = Url::parse(cookie.url.trim())
        .map_err(|err| format!("cookieStateJson url is invalid: {err}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("cookieStateJson url must start with http:// or https://".to_string());
    }
    Ok(())
}

fn validate_managed_extension(extension: &ManagedExtension) -> Result<(), String> {
    if extension.package_id.trim().is_empty()
        || extension.extension_id.trim().is_empty()
        || extension.source_path.trim().is_empty()
        || extension.source_type.trim().is_empty()
        || extension.version.trim().is_empty()
    {
        return Err(
            "extensionStateJson must include package_id, extension_id, source_path, source_type and version"
                .to_string(),
        );
    }
    if extension.source_type.trim() != "crx" {
        return Err("extensionStateJson source_type currently only supports crx".to_string());
    }
    if !Path::new(extension.source_path.trim()).is_absolute() {
        return Err("extensionStateJson source_path must be an absolute path".to_string());
    }
    Ok(())
}

fn write_cookie_state_file(
    runtime_dir: &Path,
    cookie_state: &CookieStateFile,
) -> Result<PathBuf, String> {
    fs::create_dir_all(runtime_dir)
        .map_err(|err| format!("create runtime cookie directory failed: {err}"))?;
    let path = runtime_dir.join("cookie-state.json");
    let content = serde_json::to_string_pretty(cookie_state)
        .map_err(|err| format!("serialize cookieStateJson failed: {err}"))?;
    fs::write(&path, format!("{content}\n"))
        .map_err(|err| format!("write cookie state file failed: {err}"))?;
    Ok(path)
}

fn write_extension_state_file(
    runtime_dir: &Path,
    extension_state: &ExtensionStateFile,
) -> Result<PathBuf, String> {
    fs::create_dir_all(runtime_dir)
        .map_err(|err| format!("create extension state directory failed: {err}"))?;
    let path = runtime_dir.join("extension-state.json");
    let content = serde_json::to_string_pretty(extension_state)
        .map_err(|err| format!("serialize extensionStateJson failed: {err}"))?;
    fs::write(&path, format!("{content}\n"))
        .map_err(|err| format!("write extension state file failed: {err}"))?;
    Ok(path)
}

fn build_extension_state_from_selections(
    state: &AppState,
    profile_id: &str,
    selections: &[ProfilePluginSelection],
) -> Result<ExtensionStateFile, String> {
    let plugin_package_service = state
        .plugin_package_service
        .lock()
        .map_err(|_| "plugin package service lock poisoned".to_string())?;
    let mut managed_extensions = Vec::with_capacity(selections.len());
    for selection in selections {
        let package = plugin_package_service
            .get_package(&selection.package_id)
            .map_err(error_to_string)?;
        let source_path = PathBuf::from(&package.crx_path);
        if !source_path.is_file() {
            return Err(format!(
                "plugin package file missing for {}",
                package.package_id
            ));
        }
        managed_extensions.push(ManagedExtension {
            package_id: package.package_id,
            extension_id: package.extension_id,
            source_path: source_path.to_string_lossy().to_string(),
            source_type: package.source_type,
            version: package.version,
            enabled: selection.enabled,
        });
    }
    Ok(ExtensionStateFile {
        environment_id: Some(profile_id.to_string()),
        managed_extensions,
    })
}

fn validate_plugin_selections_from_settings(
    state: &AppState,
    settings: Option<&ProfileSettings>,
) -> Result<(), String> {
    let selections = settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.plugin_selections.as_ref())
        .cloned()
        .unwrap_or_default();
    if selections.is_empty() {
        return Ok(());
    }
    let plugin_package_service = state
        .plugin_package_service
        .lock()
        .map_err(|_| "plugin package service lock poisoned".to_string())?;
    for selection in selections {
        if selection.package_id.trim().is_empty() {
            return Err("validation failed: plugin package id is required".to_string());
        }
        let package = plugin_package_service
            .get_package(&selection.package_id)
            .map_err(error_to_string)?;
        if !Path::new(&package.crx_path).is_file() {
            return Err(format!(
                "validation failed: plugin package file missing for {}",
                package.name
            ));
        }
    }
    Ok(())
}

fn sync_profile_cookie_state_from_settings_quietly(
    state: &AppState,
    profile_id: &str,
    settings: Option<&ProfileSettings>,
) {
    let engine_manager = state.lock_engine_manager();
    let path = match resolve_profile_cookie_state_path(&engine_manager, profile_id) {
        Ok(value) => value,
        Err(err) => {
            logger::warn(
                "profile_cmd",
                format!("resolve cookie state path failed profile_id={profile_id}: {err}"),
            );
            return;
        }
    };
    let cookie_state_json = settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.cookie_state_json.as_deref())
        .and_then(trim_str_to_option);
    let Some(cookie_state_json) = cookie_state_json else {
        if path.exists() {
            if let Err(err) = fs::remove_file(&path) {
                logger::warn(
                    "profile_cmd",
                    format!("remove cookie state file failed profile_id={profile_id}: {err}"),
                );
            }
        }
        return;
    };

    match parse_cookie_state_json(&cookie_state_json) {
        Ok(mut cookie_state) => {
            if cookie_state
                .environment_id
                .as_deref()
                .and_then(trim_str_to_option)
                .is_none()
            {
                cookie_state.environment_id = Some(profile_id.to_string());
            }
            if let Err(err) = write_cookie_state_file(
                path.parent().unwrap_or_else(|| Path::new(".")),
                &cookie_state,
            ) {
                logger::warn(
                    "profile_cmd",
                    format!("sync cookie state file failed profile_id={profile_id}: {err}"),
                );
            }
        }
        Err(err) => logger::warn(
            "profile_cmd",
            format!("skip syncing invalid cookie state profile_id={profile_id}: {err}"),
        ),
    }
}

pub(crate) fn sync_profile_extension_state_from_settings_quietly(
    state: &AppState,
    profile_id: &str,
    settings: Option<&ProfileSettings>,
) {
    let engine_manager = state.lock_engine_manager();
    let path = match resolve_profile_extension_state_path(&engine_manager, profile_id) {
        Ok(value) => value,
        Err(err) => {
            logger::warn(
                "profile_cmd",
                format!("resolve extension state path failed profile_id={profile_id}: {err}"),
            );
            return;
        }
    };
    let selections = settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.plugin_selections.as_ref())
        .cloned()
        .unwrap_or_default();
    if selections.is_empty() {
        if path.exists() {
            if let Err(err) = fs::remove_file(&path) {
                logger::warn(
                    "profile_cmd",
                    format!("remove extension state file failed profile_id={profile_id}: {err}"),
                );
            }
        }
        return;
    }

    match build_extension_state_from_selections(state, profile_id, &selections) {
        Ok(extension_state) => {
            if let Err(err) = write_extension_state_file(
                path.parent().unwrap_or_else(|| Path::new(".")),
                &extension_state,
            ) {
                logger::warn(
                    "profile_cmd",
                    format!("sync extension state file failed profile_id={profile_id}: {err}"),
                );
            }
        }
        Err(err) => logger::warn(
            "profile_cmd",
            format!("skip syncing invalid extension state profile_id={profile_id}: {err}"),
        ),
    }
}

pub(crate) fn read_profile_plugin_selections_from_storage(
    state: &AppState,
    profile_id: &str,
    settings: Option<&ProfileSettings>,
) -> Result<Vec<ProfilePluginSelection>, String> {
    let engine_manager = state.lock_engine_manager();
    let path = resolve_profile_extension_state_path(&engine_manager, profile_id)?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("read extension state file failed: {err}"))?;
        let parsed = parse_extension_state_json(&content)?;
        return Ok(parsed
            .managed_extensions
            .into_iter()
            .map(|item| ProfilePluginSelection {
                package_id: item.package_id,
                enabled: item.enabled,
            })
            .collect());
    }
    Ok(settings
        .and_then(|value| value.advanced.as_ref())
        .and_then(|value| value.plugin_selections.clone())
        .unwrap_or_default())
}

fn collect_cookie_site_urls(cookie_state: &CookieStateFile) -> Vec<String> {
    let mut sites = cookie_state
        .managed_cookies
        .iter()
        .filter_map(|cookie| extract_cookie_site_label(&cookie.url).ok())
        .collect::<Vec<_>>();
    sites.sort();
    sites.dedup();
    sites
}

fn extract_cookie_site_label(url: &str) -> Result<String, String> {
    let parsed = Url::parse(url).map_err(|err| format!("invalid cookie url: {err}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("cookie url must start with http:// or https://".to_string());
    }
    Ok(format!(
        "{}://{}/",
        parsed.scheme(),
        parsed.host_str().unwrap_or_default()
    ))
}

fn filter_cookie_state_by_site_label(
    cookie_state: &CookieStateFile,
    site_label: &str,
) -> Result<CookieStateFile, String> {
    let expected = extract_cookie_site_label(site_label)?;
    let managed_cookies = cookie_state
        .managed_cookies
        .iter()
        .filter(|cookie| {
            extract_cookie_site_label(&cookie.url)
                .map(|value| value == expected)
                .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(CookieStateFile {
        environment_id: cookie_state.environment_id.clone(),
        managed_cookies,
    })
}

#[tauri::command]
pub fn set_profile_group(
    state: State<'_, AppState>,
    profile_id: String,
    payload: SetProfileGroupRequest,
) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!(
            "set_profile_group request profile_id={profile_id} group={:?}",
            payload.group_name
        ),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_service
        .set_profile_group(&profile_id, payload.group_name)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn batch_set_profile_group(
    state: State<'_, AppState>,
    payload: BatchSetProfileGroupRequest,
) -> Result<BatchProfileActionResponse, String> {
    do_batch_set_profile_group(&state, payload)
}

fn do_batch_set_profile_group(
    state: &AppState,
    payload: BatchSetProfileGroupRequest,
) -> Result<BatchProfileActionResponse, String> {
    logger::info(
        "profile_cmd",
        format!(
            "batch_set_profile_group request profile_count={} group={:?}",
            payload.profile_ids.len(),
            payload.group_name
        ),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;

    let mut items = Vec::with_capacity(payload.profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in payload.profile_ids {
        match profile_service.set_profile_group(&profile_id, payload.group_name.clone()) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: payload
                        .group_name
                        .as_deref()
                        .map(|value| format!("group set to {value}"))
                        .unwrap_or_else(|| "group cleared".to_string()),
                });
            }
            Err(err) => items.push(BatchProfileActionItem {
                profile_id,
                ok: false,
                message: error_to_string(err),
            }),
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

#[tauri::command]
pub fn list_profile_font_families(platform: Option<String>) -> Result<Vec<String>, String> {
    Ok(font_catalog::list_fonts_for_platform(platform.as_deref()))
}

#[tauri::command]
pub fn list_profile_device_presets(
    state: State<'_, AppState>,
    platform: Option<String>,
) -> Result<Vec<ProfileDevicePreset>, String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    service
        .list_presets(platform.as_deref(), None)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn list_fingerprint_presets(
    state: State<'_, AppState>,
    platform: Option<String>,
    browser_version: Option<String>,
) -> Result<Vec<ProfileDevicePreset>, String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    service
        .list_presets(platform.as_deref(), browser_version.as_deref())
        .map_err(error_to_string)
}

#[tauri::command]
pub fn preview_fingerprint_bundle(
    state: State<'_, AppState>,
    source: ProfileFingerprintSource,
    font_list_mode: Option<FontListMode>,
    custom_font_list: Option<Vec<String>>,
    fingerprint_seed: Option<u32>,
) -> Result<ProfileFingerprintSnapshot, String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    preview_fingerprint_bundle_inner(
        &service,
        source,
        font_list_mode,
        custom_font_list,
        fingerprint_seed,
    )
}

#[tauri::command]
pub fn create_profile_device_preset(
    state: State<'_, AppState>,
    payload: SaveProfileDevicePresetRequest,
) -> Result<ProfileDevicePreset, String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    service.create_preset(payload).map_err(error_to_string)
}

#[tauri::command]
pub fn update_profile_device_preset(
    state: State<'_, AppState>,
    preset_id: String,
    payload: SaveProfileDevicePresetRequest,
    sync_to_profiles: Option<bool>,
) -> Result<UpdateDevicePresetOutcome, String> {
    let device_svc = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    let preset = device_svc
        .update_preset(&preset_id, payload)
        .map_err(error_to_string)?;

    let synced_count = if sync_to_profiles.unwrap_or(false) {
        let profile_svc = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        profile_svc
            .sync_preset_to_profiles(&preset_id, &device_svc)
            .map_err(error_to_string)?
    } else {
        0
    };

    Ok(UpdateDevicePresetOutcome {
        preset,
        synced_count,
    })
}

#[tauri::command]
pub fn count_profile_device_preset_references(
    state: State<'_, AppState>,
    preset_id: String,
) -> Result<usize, String> {
    let profile_svc = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    profile_svc
        .count_profiles_using_preset(&preset_id)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn delete_profile_device_preset(
    state: State<'_, AppState>,
    preset_id: String,
) -> Result<(), String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    service.delete_preset(&preset_id).map_err(error_to_string)
}

fn do_delete_profile(state: &AppState, profile_id: &str) -> Result<Profile, String> {
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| "engine session service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    if engine_manager.is_running(profile_id) {
        let _ = engine_manager.close_profile(profile_id);
    }
    let _ = engine_session_service.delete_session(profile_id);
    stop_profile_proxy_runtime_quietly(state, profile_id);

    profile_service
        .soft_delete_profile(profile_id)
        .map_err(error_to_string)
}

fn build_profile_runtime_details(
    state: &AppState,
    profile_id: &str,
) -> Result<ProfileRuntimeDetails, String> {
    {
        let profile_service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        let _ = profile_service
            .get_profile(profile_id)
            .map_err(error_to_string)?;
    }

    let engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let (profile_root_dir, user_data_dir, cache_data_dir) = engine_manager
        .profile_data_dirs(profile_id)
        .map_err(error_to_string)?;
    let runtime_handle = engine_manager.get_runtime_handle(profile_id).ok();
    let launch_args = engine_manager
        .get_runtime_launch_args(profile_id)
        .map_err(error_to_string)?;
    let extra_args = engine_manager
        .get_runtime_extra_args(profile_id)
        .map_err(error_to_string)?;

    Ok(ProfileRuntimeDetails {
        profile_id: profile_id.to_string(),
        profile_root_dir: profile_root_dir.to_string_lossy().to_string(),
        user_data_dir: user_data_dir.to_string_lossy().to_string(),
        cache_data_dir: cache_data_dir.to_string_lossy().to_string(),
        runtime_handle,
        launch_args,
        extra_args,
    })
}

#[tauri::command]
pub async fn batch_open_profiles(
    app: AppHandle,
    payload: BatchProfileActionRequest,
    task_id_prefix: Option<String>,
) -> Result<BatchProfileActionResponse, String> {
    logger::info(
        "profile_cmd",
        format!(
            "batch_open_profiles request profile_count={}",
            payload.profile_ids.len()
        ),
    );
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut items = Vec::with_capacity(payload.profile_ids.len());
        let mut success_count = 0usize;
        let task_prefix =
            task_id_prefix.unwrap_or_else(|| format!("batch-open-{}", crate::models::now_ts()));

        for profile_id in payload.profile_ids {
            let task_id = format!("{task_prefix}-{profile_id}");
            match do_open_profile(
                &state,
                Some(&app),
                Some(task_id.as_str()),
                &profile_id,
                None,
            ) {
                Ok(_) => {
                    success_count += 1;
                    logger::info(
                        "profile_cmd",
                        format!("batch_open_profiles item success profile_id={profile_id}"),
                    );
                    items.push(BatchProfileActionItem {
                        profile_id,
                        ok: true,
                        message: "opened".to_string(),
                    });
                }
                Err(err) => {
                    logger::warn(
                        "profile_cmd",
                        format!("batch_open_profiles item failed profile_id={profile_id}: {err}"),
                    );
                    items.push(BatchProfileActionItem {
                        profile_id,
                        ok: false,
                        message: err,
                    });
                }
            }
        }

        let total = items.len();
        let response = BatchProfileActionResponse {
            total,
            success_count,
            failed_count: total.saturating_sub(success_count),
            items,
        };
        logger::info(
            "profile_cmd",
            format!(
                "batch_open_profiles finished total={} success={} failed={}",
                response.total, response.success_count, response.failed_count
            ),
        );
        Ok(response)
    })
    .await
    .map_err(|err| format!("batch open profiles task join failed: {err}"))?
}

#[tauri::command]
pub fn batch_close_profiles(
    state: State<'_, AppState>,
    payload: BatchProfileActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    logger::info(
        "profile_cmd",
        format!(
            "batch_close_profiles request profile_count={}",
            payload.profile_ids.len()
        ),
    );
    let mut items = Vec::with_capacity(payload.profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in payload.profile_ids {
        match do_close_profile(&state, &profile_id) {
            Ok(_) => {
                success_count += 1;
                logger::info(
                    "profile_cmd",
                    format!("batch_close_profiles item success profile_id={profile_id}"),
                );
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "closed".to_string(),
                });
            }
            Err(err) => {
                logger::warn(
                    "profile_cmd",
                    format!("batch_close_profiles item failed profile_id={profile_id}: {err}"),
                );
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err,
                });
            }
        }
    }

    let total = items.len();
    let response = BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    };
    logger::info(
        "profile_cmd",
        format!(
            "batch_close_profiles finished total={} success={} failed={}",
            response.total, response.success_count, response.failed_count
        ),
    );
    Ok(response)
}

#[tauri::command]
pub fn get_local_api_server_status(
    state: State<'_, AppState>,
) -> Result<LocalApiServerStatus, String> {
    let local_api_server = state
        .local_api_server
        .lock()
        .map_err(|_| "local api server lock poisoned".to_string())?;
    Ok(local_api_server.status())
}

pub(crate) fn do_open_profile(
    state: &AppState,
    app: Option<&AppHandle>,
    _task_id: Option<&str>,
    profile_id: &str,
    user_options: Option<OpenProfileOptions>,
) -> Result<OpenProfileResponse, String> {
    logger::info(
        "profile_cmd",
        format!("do_open_profile start profile_id={profile_id}"),
    );
    let (mut profile_snapshot, fingerprint_seed) = {
        let profile_service = state.lock_profile_service();
        profile_service
            .ensure_profile_openable(profile_id)
            .map_err(error_to_string)?;
        let mut profile_snapshot = profile_service
            .get_profile(profile_id)
            .map_err(error_to_string)?;
        let fingerprint_seed =
            resolve_fingerprint_seed(profile_id, &mut profile_snapshot, &profile_service)?;
        (profile_snapshot, fingerprint_seed)
    };

    let profile_browser_version = profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.basic.as_ref())
        .and_then(|basic| basic.browser_version.as_deref())
        .and_then(trim_str_to_option);
    // browserVersion 是网站看到的 Chrome 伪装版本，不是实际 Chromium 可执行文件版本。
    // 优先级：profile.browser_version → preset.browser_version → 模拟平台 catalog 最新版本。
    let preset_browser_version: Option<String> = {
        let device_preset_id = profile_snapshot
            .settings
            .as_ref()
            .and_then(|settings| settings.basic.as_ref())
            .and_then(|basic| basic.device_preset_id.as_deref())
            .and_then(trim_str_to_option);
        if profile_browser_version.is_none() {
            let preset_service = state.lock_device_preset_service();
            device_preset_id
                .as_deref()
                .and_then(|id| preset_service.get_preset_spec_by_key(id))
                .and_then(|spec| trim_str_to_option(&spec.browser_version).map(|s| s.to_string()))
        } else {
            None
        }
    };
    let preferred_spoof_browser_version = profile_browser_version.or(preset_browser_version);
    let simulated_platform = profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.fingerprint.as_ref())
        .and_then(|fingerprint| fingerprint.fingerprint_source.as_ref())
        .and_then(|source| source.platform.as_deref())
        .and_then(trim_str_to_option)
        .or_else(|| {
            profile_snapshot
                .settings
                .as_ref()
                .and_then(|settings| settings.basic.as_ref())
                .and_then(|basic| basic.platform.as_deref())
                .and_then(trim_str_to_option)
        })
        .unwrap_or_else(|| "macos".to_string());
    let resolved_browser_version = preferred_spoof_browser_version
        .clone()
        .unwrap_or_else(|| {
            crate::chromium_version_catalog::latest_for(&simulated_platform)
                .version
                .to_string()
        });
    let chromium_executable = {
        let resource_service = state.lock_resource_service();
        // 在 debug 模式下，优先使用开发者配置的自定义 Chromium 路径
        #[cfg(debug_assertions)]
        let dev_override: Option<std::path::PathBuf> = {
            let pref_svc = state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            pref_svc
                .read_dev_chromium_executable()
                .ok()
                .flatten()
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_file())
        };
        #[cfg(not(debug_assertions))]
        let dev_override: Option<std::path::PathBuf> = None;

        let chromium_executable = dev_override
            .or_else(|| resource_service.resolve_active_chromium_executable())
            .unwrap_or_default();
        // Fast-fail when Chromium is not installed: do NOT auto-download inside this sync
        // command — it would block the IPC thread for minutes and hang the UI entirely.
        // Users must download Chromium from Settings → Resources first.
        if state.require_real_engine && !chromium_executable.is_file() {
            return Err("Chromium 未安装，请前往「设置 → 资源」页面下载后再启动环境".to_string());
        }
        chromium_executable
    };
    let active_chromium = chromium_executable
        .is_file()
        .then_some(chromium_executable.clone());
    logger::info(
        "profile_cmd",
        format!(
            "resolved chromium executable profile_id={profile_id} spoof_version={preferred_spoof_browser_version:?} resolved_spoof_version={resolved_browser_version} executable={active_chromium:?}"
        ),
    );
    if profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.basic.as_ref())
        .and_then(|basic| basic.browser_version.as_deref())
        .is_none()
    {
        profile_snapshot
            .settings
            .get_or_insert_with(Default::default)
            .basic
            .get_or_insert_with(Default::default)
            .browser_version = Some(resolved_browser_version.clone());
    }

    let bound_proxy = state
        .lock_proxy_service()
        .get_profile_proxy(profile_id)
        .map_err(error_to_string)?;
    let daemon_proxy_server = match bound_proxy.as_ref() {
        Some(proxy) => {
            let mut local_api_server = state.lock_local_api_server();
            Some(local_api_server.start_proxy_runtime(profile_id, proxy)?)
        }
        None => None,
    };
    let geoip_database = state.lock_resource_service().resolve_geoip_database_path();
    let mut engine_manager = state.lock_engine_manager();
    let mut merged_options = merge_open_options(profile_snapshot.settings.as_ref(), user_options);
    merged_options.fingerprint_seed = Some(fingerprint_seed);
    // 若未指定启动 URL，使用全局默认启动 URL（若已配置）
    if merged_options
        .startup_urls
        .as_ref()
        .map_or(true, |v| v.is_empty())
        && merged_options.startup_url.is_none()
    {
        if let Ok(global_url) = state
            .app_preference_service
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .read_global_default_startup_url()
        {
            merged_options.startup_url = global_url;
        }
    }
    let cookie_state_file = prepare_cookie_state_file(
        profile_id,
        profile_snapshot.settings.as_ref(),
        &engine_manager,
    )?;
    let extension_state_file = prepare_extension_state_file(
        state,
        profile_id,
        profile_snapshot.settings.as_ref(),
        &engine_manager,
    )?;
    let locale_mode = profile_snapshot
        .settings
        .as_ref()
        .and_then(|s| s.locale_mode)
        .unwrap_or(crate::models::LocaleMode::Auto);

    // Auto 模式 + 有代理：若代理 effective locale 缺失则触发一次轻量 GeoIP 查询并持久化
    let refreshed_proxy: Option<crate::models::Proxy> = if locale_mode
        == crate::models::LocaleMode::Auto
    {
        if let (Some(proxy), Some(ref db_path)) = (bound_proxy.as_ref(), geoip_database.as_ref()) {
            if proxy.effective_language.is_none() && proxy.effective_timezone.is_none() {
                match state
                    .lock_proxy_service()
                    .ensure_proxy_locale_fresh(&proxy.id, db_path)
                {
                    Ok(fresh) => Some(fresh),
                    Err(err) => {
                        logger::warn(
                            "profile_cmd",
                            format!(
                                "proxy locale refresh failed, falling back to host locale: {err}"
                            ),
                        );
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let effective_bound_proxy = refreshed_proxy.as_ref().or(bound_proxy.as_ref());

    let device_preset_service = state.lock_device_preset_service();
    // Auto 模式 + 无代理：若缓存过期则同步刷新 host locale
    let host_locale =
        if locale_mode == crate::models::LocaleMode::Auto && effective_bound_proxy.is_none() {
            state.host_locale_service.refresh_for_launch()
        } else {
            None
        };

    let mut launch_options = resolve_launch_options(
        &device_preset_service,
        profile_id,
        &profile_snapshot.name,
        profile_snapshot.settings.as_ref(),
        merged_options,
        effective_bound_proxy,
        daemon_proxy_server.clone(),
        geoip_database,
        Some(resolved_browser_version.as_str()),
        host_locale.as_ref(),
    )?;
    launch_options.background_color = profile_snapshot.resolved_browser_bg_color.clone();
    launch_options.toolbar_text = profile_snapshot.resolved_toolbar_text.clone();
    launch_options.dock_icon_text = profile_snapshot.resolved_toolbar_text.clone();
    launch_options.cookie_state_file = cookie_state_file;
    launch_options.extension_state_file = extension_state_file;
    // bookmark_state_file: 路径始终传递，Chromium 会在首次修改书签时自动创建
    launch_options.bookmark_state_file = engine_manager
        .profile_data_dirs(profile_id)
        .ok()
        .map(|(data_dir, _, _)| data_dir.join("runtime").join("bookmark-state.json"));
    launch_options.logging_enabled = state
        .app_preference_service
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .read_chromium_logging_enabled()
        .unwrap_or(true);
    logger::info(
        "profile_cmd",
        format!(
            "resolved launch options profile_id={profile_id} launch_options={launch_options:?}"
        ),
    );
    engine_manager.set_chromium_executable(active_chromium);

    let session = engine_manager
        .open_profile_with_options(profile_id, &launch_options)
        .map_err(|err| {
            stop_profile_proxy_runtime_quietly(state, profile_id);
            error_to_string(err)
        })?;

    // Release engine_manager lock before any blocking HTTP calls.
    // apply_profile_visual_overrides contacts the Magic Controller which is not yet ready
    // immediately after Chromium spawns — retrying with 2s timeouts would block for up to
    // 64 seconds and freeze the IPC thread. Run it in a background thread instead.
    drop(engine_manager);

    if let Some(app) = app {
        let app = app.clone();
        let profile_id_bg = profile_id.to_string();
        let background_color = launch_options.background_color.clone();
        let toolbar_text = launch_options.toolbar_text.clone();
        // Start WebSocket event subscription for real Chromium sessions.
        if let Some(magic_port) = session.magic_port {
            let app_ws = app.clone();
            let profile_id_ws = profile_id.to_string();
            tauri::async_runtime::spawn(crate::engine_manager::subscribe_chromium_events(
                app_ws,
                profile_id_ws,
                magic_port,
            ));
        }
        std::thread::spawn(move || {
            let state = app.state::<AppState>();
            let _ = state.lock_engine_manager().apply_profile_visual_overrides(
                &profile_id_bg,
                background_color,
                toolbar_text,
            );
        });
    }

    let profile = {
        let profile_service = state.lock_profile_service();
        match profile_service.mark_profile_running(profile_id, true) {
            Ok(profile) => profile,
            Err(err) => {
                let _ = state.lock_engine_manager().close_profile(profile_id);
                stop_profile_proxy_runtime_quietly(state, profile_id);
                return Err(error_to_string(err));
            }
        }
    };
    if let Err(err) = state
        .lock_engine_session_service()
        .save_session(profile_id, &session)
    {
        let _ = state.lock_engine_manager().close_profile(profile_id);
        let _ = state
            .lock_profile_service()
            .mark_profile_running(profile_id, false);
        stop_profile_proxy_runtime_quietly(state, profile_id);
        return Err(error_to_string(err));
    }
    logger::info(
        "profile_cmd",
        format!(
            "do_open_profile success profile_id={profile_id} session_id={} pid={:?}",
            session.session_id, session.pid
        ),
    );

    Ok(OpenProfileResponse { profile, session })
}

fn unbind_profile_proxy_if_exists(
    proxy_service: &crate::services::proxy_service::ProxyService,
    profile_id: &str,
) -> Result<(), String> {
    match proxy_service.unbind_profile_proxy(profile_id) {
        Ok(_) => Ok(()),
        Err(AppError::NotFound(_)) => {
            logger::info(
                "profile_cmd",
                format!("skip proxy unbind because binding not found profile_id={profile_id}"),
            );
            Ok(())
        }
        Err(err) => Err(error_to_string(err)),
    }
}

pub(crate) fn refresh_profile_locale_for_bound_proxy(
    state: &AppState,
    profile_id: &str,
    proxy_id: &str,
) -> Result<Profile, String> {
    let geoip_database = state.lock_resource_service().resolve_geoip_database_path();
    let proxy = {
        let proxy_service = state.lock_proxy_service();
        if let Some(geoip_database) = geoip_database {
            match proxy_service.ensure_proxy_locale_fresh(proxy_id, &geoip_database) {
                Ok(proxy) => proxy,
                Err(err) => {
                    logger::warn(
                        "profile_cmd",
                        format!(
                            "proxy locale refresh failed during binding proxy_id={proxy_id}: {err}"
                        ),
                    );
                    proxy_service.get_proxy(proxy_id).map_err(error_to_string)?
                }
            }
        } else {
            proxy_service.get_proxy(proxy_id).map_err(error_to_string)?
        }
    };

    overwrite_profile_locale(
        state,
        profile_id,
        proxy.effective_language,
        proxy.effective_timezone,
    )
}

pub(crate) fn refresh_profile_locale_for_unbound_profile(
    state: &AppState,
    profile_id: &str,
) -> Result<Profile, String> {
    let suggestion = state.host_locale_service.refresh_for_launch();
    overwrite_profile_locale(
        state,
        profile_id,
        suggestion.as_ref().and_then(|value| value.language.clone()),
        suggestion.as_ref().and_then(|value| value.timezone.clone()),
    )
}

fn overwrite_profile_locale(
    state: &AppState,
    profile_id: &str,
    language: Option<String>,
    timezone_id: Option<String>,
) -> Result<Profile, String> {
    state
        .lock_profile_service()
        .overwrite_profile_locale(profile_id, language, timezone_id)
        .map_err(error_to_string)
}

fn resolve_launch_options(
    device_preset_service: &DevicePresetService,
    profile_id: &str,
    profile_name: &str,
    profile_settings: Option<&ProfileSettings>,
    options: OpenProfileOptions,
    bound_proxy: Option<&Proxy>,
    daemon_proxy_server: Option<String>,
    geoip_database: Option<std::path::PathBuf>,
    resolved_browser_version: Option<&str>,
    host_locale: Option<&crate::services::host_locale_service::HostLocaleSuggestion>,
) -> Result<EngineLaunchOptions, String> {
    let startup_urls =
        normalize_startup_urls(options.startup_urls.clone(), options.startup_url.clone())
            .map_err(|_| format!("validation failed: invalid startupUrl for {profile_id}"))?
            .unwrap_or_default();
    let geolocation_mode = resolve_effective_geolocation_mode(&options);
    let geolocation = resolve_effective_geolocation(
        profile_id,
        geolocation_mode,
        options.geolocation.clone(),
        bound_proxy,
        geoip_database.as_deref(),
    )?;
    let proxy_server = if let Some(proxy_server) = daemon_proxy_server.and_then(trim_to_option) {
        Some(proxy_server)
    } else {
        match bound_proxy {
            Some(proxy) => Some(proxy_to_arg(proxy)?),
            None => None,
        }
    };
    let mut runtime_snapshot = resolve_runtime_fingerprint_snapshot(
        device_preset_service,
        profile_settings,
        resolved_browser_version,
        options.language.as_deref(),
        options.timezone_id.as_deref(),
        options.fingerprint_seed,
    )?;
    let user_agent = runtime_snapshot.user_agent.clone();
    let custom_font_list = runtime_snapshot.custom_font_list.clone();
    let custom_cpu_cores = runtime_snapshot.custom_cpu_cores;
    let custom_ram_gb = runtime_snapshot.custom_ram_gb;
    let locale_mode_for_launch = profile_settings
        .and_then(|s| s.locale_mode)
        .unwrap_or(crate::models::LocaleMode::Auto);

    // Manual 模式：直接使用 snapshot 字段，不做任何 fallback
    // Auto 模式：回退链 snapshot → proxy → host IP（仅无代理时）
    let language = if locale_mode_for_launch == crate::models::LocaleMode::Manual {
        runtime_snapshot.language.clone()
    } else {
        runtime_snapshot
            .language
            .clone()
            .or_else(|| bound_proxy.and_then(default_language_from_proxy))
            .or_else(|| {
                if bound_proxy.is_none() {
                    host_locale.as_ref().and_then(|h| h.language.clone())
                } else {
                    None
                }
            })
    };
    let timezone_id = if locale_mode_for_launch == crate::models::LocaleMode::Manual {
        runtime_snapshot.time_zone.clone()
    } else {
        runtime_snapshot
            .time_zone
            .clone()
            .or_else(|| bound_proxy.and_then(default_timezone_from_proxy))
            .or_else(|| {
                if bound_proxy.is_none() {
                    host_locale.as_ref().and_then(|h| h.timezone.clone())
                } else {
                    None
                }
            })
    };
    // 把回退结果写回 snapshot，使 append_snapshot_args 能生成 --custom-main-language 等 flag
    if runtime_snapshot.language.is_none() {
        if let Some(ref lang) = language {
            runtime_snapshot.language = Some(lang.clone());
            if runtime_snapshot.accept_languages.is_none() {
                runtime_snapshot.accept_languages = Some(derive_accept_languages(lang));
            }
        }
    }
    if runtime_snapshot.time_zone.is_none() {
        runtime_snapshot.time_zone = timezone_id.clone();
    }

    let mut extra_args = Vec::new();
    let web_rtc_mode = options.web_rtc_mode.unwrap_or(WebRtcMode::Real);
    let web_rtc_override_ip = resolve_web_rtc_override_ip(
        profile_id,
        web_rtc_mode.clone(),
        options.webrtc_ip_override.as_deref(),
        bound_proxy,
    )?;
    match web_rtc_mode {
        WebRtcMode::Real => {}
        WebRtcMode::FollowIp | WebRtcMode::Replace => {
            if let Some(ip) = web_rtc_override_ip {
                extra_args.push(format!("--webrtc-ip-override={ip}"));
            }
        }
        WebRtcMode::Disable => {
            extra_args.push("--disable-webrtc".to_string());
        }
    }
    if let Some(geo) = geolocation {
        extra_args.push(format!("--custom-geolocation-latitude={}", geo.latitude));
        extra_args.push(format!("--custom-geolocation-longitude={}", geo.longitude));
        if let Some(accuracy) = geo.accuracy {
            extra_args.push(format!("--custom-geolocation-accuracy={accuracy}"));
        }
    }
    if options.auto_allow_geolocation.unwrap_or(false) {
        extra_args.push("--auto-allow-geolocation".to_string());
    }
    match resolve_effective_custom_value_mode(options.device_name_mode) {
        CustomValueMode::Real => {}
        CustomValueMode::Custom => {
            let value = options
                .custom_device_name
                .as_deref()
                .and_then(trim_str_to_option)
                .ok_or_else(|| {
                    format!("validation failed: custom device name is required for {profile_id}")
                })?;
            if !is_valid_custom_device_name(&value) {
                return Err(format!(
                    "validation failed: invalid custom device name for {profile_id}"
                ));
            }
            extra_args.push(format!("--custom-host-name={value}"));
        }
    }
    match resolve_effective_custom_value_mode(options.mac_address_mode) {
        CustomValueMode::Real => {}
        CustomValueMode::Custom => {
            let value = options
                .custom_mac_address
                .as_deref()
                .and_then(trim_str_to_option)
                .ok_or_else(|| {
                    format!("validation failed: custom mac address is required for {profile_id}")
                })?
                .to_uppercase();
            if !is_valid_custom_mac_address(&value) {
                return Err(format!(
                    "validation failed: invalid custom mac address for {profile_id}"
                ));
            }
            extra_args.push(format!("--custom-mac-address={value}"));
        }
    }
    if options.do_not_track_enabled.unwrap_or(false) {
        extra_args.push("--enable-do-not-track".to_string());
    }
    if proxy_server.is_some() {
        extra_args.push("--enable-dns-leak-protection".to_string());
    }
    if options.port_scan_protection.unwrap_or(false) {
        extra_args.push("--enable-port-scan-protection".to_string());
    }
    if options.automation_detection_shield.unwrap_or(false) {
        extra_args.push("--enable-automation-detection-shield".to_string());
    }
    let image_loading_mode = options
        .image_loading_mode
        .as_deref()
        .and_then(trim_str_to_option)
        .or_else(|| {
            options
                .disable_images
                .unwrap_or(false)
                .then(|| "block".to_string())
        });
    if let Some(mode) = image_loading_mode {
        match mode.as_str() {
            "off" => {}
            "block" => extra_args.push("--custom-image-loading-mode=block".to_string()),
            "max-area" => {
                let max_area = options.image_max_area.ok_or_else(|| {
                    format!("validation failed: image max area is required for {profile_id}")
                })?;
                if max_area == 0 {
                    return Err(format!(
                        "validation failed: image max area must be positive for {profile_id}"
                    ));
                }
                extra_args.push("--custom-image-loading-mode=max-area".to_string());
                extra_args.push(format!("--custom-image-max-area={max_area}"));
            }
            _ => {
                return Err(format!(
                    "validation failed: unsupported image loading mode for {profile_id}: {mode}"
                ));
            }
        }
    }
    if let Some(seed) = runtime_snapshot
        .fingerprint_seed
        .or(options.fingerprint_seed)
    {
        extra_args.push(format!("--fingerprint-seed={seed}"));
    } else {
        extra_args.push(format!(
            "--fingerprint-seed={}",
            generate_random_u32(profile_id)
        ));
    }
    append_snapshot_args(&mut extra_args, &runtime_snapshot);
    if let Some(custom_args) = options.custom_launch_args {
        for arg in custom_args {
            if let Some(value) = trim_to_option(arg) {
                extra_args.push(value);
            }
        }
    }

    let mut toolbar_text = Some(
        profile_id
            .strip_prefix("pf_")
            .unwrap_or(profile_id)
            .parse::<i64>()
            .map(|value| value.to_string())
            .unwrap_or_else(|_| profile_name.to_string()),
    );
    let mut background_color = None;
    if let Some(settings) = profile_settings.and_then(|value| value.basic.as_ref()) {
        if let Some(value) = settings
            .toolbar_text
            .as_deref()
            .and_then(trim_str_to_option)
        {
            toolbar_text = Some(value);
        }
        background_color = match settings.browser_bg_color_mode {
            Some(crate::models::BrowserBgColorMode::None) => None,
            Some(crate::models::BrowserBgColorMode::Inherit) => None,
            Some(crate::models::BrowserBgColorMode::Custom) => settings
                .browser_bg_color
                .as_deref()
                .and_then(trim_str_to_option),
            None => settings
                .browser_bg_color
                .as_deref()
                .and_then(trim_str_to_option),
        };
    }

    Ok(EngineLaunchOptions {
        user_agent,
        language,
        timezone_id,
        startup_urls,
        proxy_server,
        web_rtc_policy: None,
        headless: options.headless.unwrap_or(false),
        disable_images: false,
        toolbar_text: toolbar_text.clone(),
        background_color,
        custom_cpu_cores,
        custom_ram_gb,
        custom_font_list,
        cookie_state_file: None,
        extension_state_file: None,
        bookmark_state_file: None,
        dock_icon_text: toolbar_text,
        dock_icon_text_color: None,
        extra_args,
        logging_enabled: true,
    })
}

fn resolve_effective_geolocation_mode(options: &OpenProfileOptions) -> GeolocationMode {
    options
        .geolocation_mode
        .clone()
        .or_else(|| {
            options
                .geolocation
                .as_ref()
                .map(|_| GeolocationMode::Custom)
        })
        .unwrap_or(GeolocationMode::Off)
}

fn resolve_effective_custom_value_mode(mode: Option<CustomValueMode>) -> CustomValueMode {
    mode.unwrap_or(CustomValueMode::Real)
}

fn is_valid_custom_device_name(value: &str) -> bool {
    let bytes = value.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 63
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
}

fn is_valid_custom_mac_address(value: &str) -> bool {
    let parts = value.split(':').collect::<Vec<_>>();
    parts.len() == 6
        && parts
            .iter()
            .all(|part| part.len() == 2 && part.chars().all(|ch| ch.is_ascii_hexdigit()))
}

fn resolve_effective_geolocation(
    profile_id: &str,
    geolocation_mode: GeolocationMode,
    geolocation: Option<GeolocationOverride>,
    bound_proxy: Option<&Proxy>,
    geoip_database: Option<&Path>,
) -> Result<Option<GeolocationOverride>, String> {
    let resolved = match geolocation_mode {
        GeolocationMode::Off => None,
        GeolocationMode::Custom => Some(geolocation.ok_or_else(|| {
            format!("validation failed: missing geolocation coordinates for {profile_id}")
        })?),
        GeolocationMode::Ip => bound_proxy
            .and_then(default_geolocation_from_proxy)
            .or_else(|| resolve_local_public_geolocation(profile_id, geoip_database)),
    };

    if let Some(geo) = resolved.as_ref() {
        validate_geolocation(profile_id, geo)?;
    }

    Ok(resolved)
}

fn validate_geolocation(profile_id: &str, geo: &GeolocationOverride) -> Result<(), String> {
    if !(-90.0..=90.0).contains(&geo.latitude) {
        return Err(format!(
            "validation failed: invalid latitude for {profile_id}"
        ));
    }
    if !(-180.0..=180.0).contains(&geo.longitude) {
        return Err(format!(
            "validation failed: invalid longitude for {profile_id}"
        ));
    }
    if let Some(accuracy) = geo.accuracy {
        if accuracy <= 0.0 {
            return Err(format!(
                "validation failed: invalid geolocation accuracy for {profile_id}"
            ));
        }
    }
    Ok(())
}

fn resolve_local_public_geolocation(
    profile_id: &str,
    geoip_database: Option<&Path>,
) -> Option<GeolocationOverride> {
    let geoip_database = geoip_database?;
    let public_ip = match fetch_public_ip() {
        Ok(value) => value,
        Err(err) => {
            logger::warn(
                "profile_cmd",
                format!(
                    "skip local public geolocation lookup because public ip fetch failed profile_id={profile_id} err={err}"
                ),
            );
            return None;
        }
    };

    match lookup_geoip_geolocation(geoip_database, &public_ip) {
        Ok(geo) => Some(geo),
        Err(err) => {
            logger::warn(
                "profile_cmd",
                format!(
                    "skip local public geolocation lookup because geoip lookup failed profile_id={profile_id} ip={public_ip} err={err}"
                ),
            );
            None
        }
    }
}

fn fetch_public_ip() -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(PUBLIC_IP_LOOKUP_TIMEOUT_SECS))
        .build()
        .map_err(|err| format!("failed to build public ip client: {err}"))?;
    crate::runtime_compat::block_on_compat(async move {
        for url in PUBLIC_IP_LOOKUP_URLS {
            let response = match client.get(*url).send().await {
                Ok(value) => value,
                Err(_) => continue,
            };
            if !response.status().is_success() {
                continue;
            }
            if url.ends_with("format=json") {
                let payload = match response.json::<PublicIpResponse>().await {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                if let Some(ip) = payload.ip.and_then(trim_to_option) {
                    return Ok(ip);
                }
                continue;
            }
            let body = match response.text().await {
                Ok(value) => value,
                Err(_) => continue,
            };
            if let Some(ip) = trim_to_option(body) {
                return Ok(ip);
            }
        }

        Err("all public ip lookup endpoints failed".to_string())
    })
}

fn resolve_web_rtc_override_ip(
    profile_id: &str,
    web_rtc_mode: WebRtcMode,
    webrtc_ip_override: Option<&str>,
    bound_proxy: Option<&Proxy>,
) -> Result<Option<String>, String> {
    resolve_web_rtc_override_ip_with(
        profile_id,
        web_rtc_mode,
        webrtc_ip_override,
        bound_proxy,
        fetch_public_ip,
    )
}

fn resolve_web_rtc_override_ip_with<F>(
    profile_id: &str,
    web_rtc_mode: WebRtcMode,
    webrtc_ip_override: Option<&str>,
    bound_proxy: Option<&Proxy>,
    public_ip_resolver: F,
) -> Result<Option<String>, String>
where
    F: Fn() -> Result<String, String>,
{
    match web_rtc_mode {
        WebRtcMode::Real | WebRtcMode::Disable => Ok(None),
        WebRtcMode::Replace => {
            let ip = webrtc_ip_override
                .and_then(trim_str_to_option)
                .ok_or_else(|| {
                    format!(
                        "validation failed: replace webRtc mode requires webrtcIpOverride for {profile_id}"
                    )
                })?;
            if ip.parse::<std::net::IpAddr>().is_err() {
                return Err(format!(
                    "validation failed: invalid webrtcIpOverride for {profile_id}"
                ));
            }
            Ok(Some(ip.to_string()))
        }
        WebRtcMode::FollowIp => {
            if let Some(ip) = bound_proxy
                .and_then(|proxy| proxy.exit_ip.as_deref())
                .and_then(trim_str_to_option)
            {
                if ip.parse::<std::net::IpAddr>().is_ok() {
                    return Ok(Some(ip.to_string()));
                }
            }
            match public_ip_resolver() {
                Ok(ip) => {
                    let ip = ip.trim();
                    if ip.parse::<std::net::IpAddr>().is_err() {
                        logger::warn(
                            "profile_cmd",
                            format!(
                                "skip web rtc follow_ip override because public ip is invalid profile_id={profile_id} ip={ip}"
                            ),
                        );
                        return Ok(None);
                    }
                    Ok(Some(ip.to_string()))
                }
                Err(err) => {
                    logger::warn(
                        "profile_cmd",
                        format!(
                            "skip web rtc follow_ip override because public ip fetch failed profile_id={profile_id} err={err}"
                        ),
                    );
                    Ok(None)
                }
            }
        }
    }
}

fn merge_open_options(
    settings: Option<&ProfileSettings>,
    user_options: Option<OpenProfileOptions>,
) -> OpenProfileOptions {
    let mut merged = OpenProfileOptions::default();

    if let Some(settings) = settings {
        if let Some(basic) = settings.basic.as_ref() {
            merged.startup_urls = basic
                .startup_urls
                .clone()
                .or_else(|| basic.startup_url.as_ref().cloned().map(|value| vec![value]));
        }
        if let Some(fingerprint) = settings.fingerprint.as_ref() {
            let snapshot = fingerprint.fingerprint_snapshot.as_ref();
            let allow_legacy_settings_fallback = snapshot.is_none();
            merged.language = snapshot
                .and_then(|value| value.language.clone())
                .or_else(|| {
                    allow_legacy_settings_fallback
                        .then(|| fingerprint.language.clone())
                        .flatten()
                });
            merged.timezone_id = snapshot
                .and_then(|value| value.time_zone.clone())
                .or_else(|| {
                    allow_legacy_settings_fallback
                        .then(|| fingerprint.timezone_id.clone())
                        .flatten()
                });
            merged.device_name_mode = fingerprint.device_name_mode;
            merged.custom_device_name = fingerprint.custom_device_name.clone();
            merged.mac_address_mode = fingerprint.mac_address_mode;
            merged.custom_mac_address = fingerprint.custom_mac_address.clone();
            merged.do_not_track_enabled = fingerprint.do_not_track_enabled;
            merged.web_rtc_mode = fingerprint.web_rtc_mode.clone();
            merged.webrtc_ip_override = fingerprint.webrtc_ip_override.clone();
        }
        if let Some(advanced) = settings.advanced.as_ref() {
            merged.geolocation_mode = advanced.geolocation_mode.clone().or_else(|| {
                advanced
                    .geolocation
                    .as_ref()
                    .map(|_| GeolocationMode::Custom)
            });
            merged.auto_allow_geolocation = advanced.auto_allow_geolocation;
            merged.geolocation = advanced.geolocation.clone();
            merged.headless = advanced.headless;
            merged.disable_images = advanced.disable_images;
            merged.port_scan_protection = advanced.port_scan_protection;
            merged.automation_detection_shield = advanced.automation_detection_shield;
            merged.image_loading_mode = advanced.image_loading_mode.clone();
            merged.image_max_area = advanced.image_max_area;
            merged.custom_launch_args = advanced.custom_launch_args.clone();
            merged.fingerprint_seed = advanced.fixed_fingerprint_seed;
        }
    }

    if let Some(overrides) = user_options {
        if overrides.language.is_some() {
            merged.language = overrides.language;
        }
        if overrides.timezone_id.is_some() {
            merged.timezone_id = overrides.timezone_id;
        }
        if overrides.startup_url.is_some() {
            merged.startup_urls = None;
            merged.startup_url = overrides.startup_url;
        }
        if overrides.startup_urls.is_some() {
            merged.startup_urls = overrides.startup_urls;
            merged.startup_url = None;
        }
        if overrides.geolocation_mode.is_some() {
            merged.geolocation_mode = overrides.geolocation_mode;
        }
        if overrides.auto_allow_geolocation.is_some() {
            merged.auto_allow_geolocation = overrides.auto_allow_geolocation;
        }
        if overrides.geolocation.is_some() {
            merged.geolocation = overrides.geolocation;
        }
        if overrides.device_name_mode.is_some() {
            merged.device_name_mode = overrides.device_name_mode;
        }
        if overrides.custom_device_name.is_some() {
            merged.custom_device_name = overrides.custom_device_name;
        }
        if overrides.mac_address_mode.is_some() {
            merged.mac_address_mode = overrides.mac_address_mode;
        }
        if overrides.custom_mac_address.is_some() {
            merged.custom_mac_address = overrides.custom_mac_address;
        }
        if overrides.web_rtc_mode.is_some() {
            merged.web_rtc_mode = overrides.web_rtc_mode;
        }
        if overrides.webrtc_ip_override.is_some() {
            merged.webrtc_ip_override = overrides.webrtc_ip_override;
        }
        if overrides.do_not_track_enabled.is_some() {
            merged.do_not_track_enabled = overrides.do_not_track_enabled;
        }
        if overrides.headless.is_some() {
            merged.headless = overrides.headless;
        }
        if overrides.disable_images.is_some() {
            merged.disable_images = overrides.disable_images;
        }
        if overrides.port_scan_protection.is_some() {
            merged.port_scan_protection = overrides.port_scan_protection;
        }
        if overrides.automation_detection_shield.is_some() {
            merged.automation_detection_shield = overrides.automation_detection_shield;
        }
        if overrides.image_loading_mode.is_some() {
            merged.image_loading_mode = overrides.image_loading_mode;
        }
        if overrides.image_max_area.is_some() {
            merged.image_max_area = overrides.image_max_area;
        }
        if overrides.custom_launch_args.is_some() {
            merged.custom_launch_args = overrides.custom_launch_args;
        }
        if overrides.fingerprint_seed.is_some() {
            merged.fingerprint_seed = overrides.fingerprint_seed;
        }
    }

    merged
}

fn resolve_runtime_fingerprint_snapshot(
    device_preset_service: &DevicePresetService,
    profile_settings: Option<&ProfileSettings>,
    resolved_browser_version: Option<&str>,
    language_override: Option<&str>,
    timezone_override: Option<&str>,
    fingerprint_seed: Option<u32>,
) -> Result<ProfileFingerprintSnapshot, String> {
    let basic = profile_settings.and_then(|settings| settings.basic.as_ref());
    let fingerprint = profile_settings.and_then(|settings| settings.fingerprint.as_ref());
    let base_snapshot = fingerprint
        .and_then(|settings| settings.fingerprint_snapshot.as_ref())
        .cloned();

    if let Some(snapshot) = base_snapshot.clone() {
        let browser_version_override = resolved_browser_version.and_then(trim_str_to_option);
        let language_override = language_override.and_then(trim_str_to_option);
        let timezone_override = timezone_override.and_then(trim_str_to_option);
        let should_re_resolve = browser_version_override.as_deref()
            != snapshot.browser_version.as_deref()
            || language_override.as_deref() != snapshot.language.as_deref()
            || timezone_override.as_deref() != snapshot.time_zone.as_deref()
            || fingerprint_seed != snapshot.fingerprint_seed;
        if !should_re_resolve {
            let mut snapshot = snapshot;
            apply_fingerprint_resolution_overrides(&mut snapshot, fingerprint);
            return Ok(snapshot);
        }
    }

    let preset_id_for_ver = basic.and_then(|item| item.device_preset_id.as_deref());
    let preset_ver_owned = preset_id_for_ver
        .and_then(|id| device_preset_service.get_preset_spec_by_key(id))
        .map(|spec| spec.browser_version);
    let source = fingerprint
        .and_then(|settings| settings.fingerprint_source.as_ref())
        .cloned()
        .unwrap_or_else(|| {
            fingerprint_catalog::normalize_source(
                None,
                basic.and_then(|item| item.platform.as_deref()),
                resolved_browser_version
                    .or_else(|| basic.and_then(|item| item.browser_version.as_deref())),
                preset_ver_owned.as_deref(),
                preset_id_for_ver,
                profile_settings
                    .and_then(|settings| settings.advanced.as_ref())
                    .and_then(|settings| settings.random_fingerprint)
                    .unwrap_or(false),
            )
        });
    let mut runtime_source = source.clone();
    if let Some(version) = resolved_browser_version.and_then(trim_str_to_option) {
        runtime_source.browser_version = Some(version);
    }

    let seed = fingerprint_seed.or_else(|| {
        base_snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.fingerprint_seed)
    });
    let platform = runtime_source
        .platform
        .as_deref()
        .ok_or_else(|| "validation failed: fingerprint platform is required".to_string())?;
    let preset = device_preset_service
        .resolve_preset(platform, runtime_source.device_preset_id.as_deref())
        .map_err(error_to_string)?;
    let snapshot = fingerprint_catalog::resolve_fingerprint_snapshot_from_preset(
        &preset,
        &runtime_source,
        language_override.or_else(|| fingerprint.and_then(|settings| settings.language.as_deref())),
        timezone_override
            .or_else(|| fingerprint.and_then(|settings| settings.timezone_id.as_deref())),
        seed,
    )
    .map_err(error_to_string)?;
    let font_list_mode = fingerprint
        .and_then(|settings| settings.font_list_mode)
        .unwrap_or(FontListMode::Preset);
    let fonts = font_catalog::resolve_fonts_for_mode(
        snapshot.platform.as_deref(),
        font_list_mode,
        fingerprint.and_then(|settings| settings.custom_font_list.as_ref()),
        seed,
    )
    .map_err(error_to_string)?;
    let mut snapshot = snapshot;
    snapshot.custom_font_list = Some(fonts);
    apply_fingerprint_resolution_overrides(&mut snapshot, fingerprint);

    Ok(snapshot)
}

fn preview_fingerprint_bundle_inner(
    device_preset_service: &DevicePresetService,
    source: ProfileFingerprintSource,
    font_list_mode: Option<FontListMode>,
    custom_font_list: Option<Vec<String>>,
    fingerprint_seed: Option<u32>,
) -> Result<ProfileFingerprintSnapshot, String> {
    let platform = source
        .platform
        .as_deref()
        .ok_or_else(|| "validation failed: fingerprint platform is required".to_string())?;
    let preset = device_preset_service
        .resolve_preset(platform, source.device_preset_id.as_deref())
        .map_err(error_to_string)?;
    let mut snapshot = fingerprint_catalog::resolve_fingerprint_snapshot_from_preset(
        &preset,
        &source,
        None,
        None,
        source_seed(&source, fingerprint_seed),
    )
    .map_err(error_to_string)?;
    let fonts = font_catalog::resolve_fonts_for_mode(
        snapshot.platform.as_deref(),
        font_list_mode.unwrap_or(FontListMode::Preset),
        custom_font_list.as_ref(),
        snapshot.fingerprint_seed,
    )
    .map_err(error_to_string)?;
    snapshot.custom_font_list = Some(fonts);
    Ok(snapshot)
}

fn append_snapshot_args(extra_args: &mut Vec<String>, snapshot: &ProfileFingerprintSnapshot) {
    if let Some(metadata) = snapshot
        .custom_ua_metadata
        .as_deref()
        .and_then(trim_str_to_option)
    {
        extra_args.push(format!("--custom-ua-metadata={metadata}"));
    }
    if let Some(custom_platform) = snapshot
        .custom_platform
        .as_deref()
        .and_then(trim_str_to_option)
    {
        extra_args.push(format!("--custom-platform={custom_platform}"));
    }
    if let Some(gl_vendor) = snapshot
        .custom_gl_vendor
        .as_deref()
        .and_then(trim_str_to_option)
    {
        extra_args.push(format!("--custom-gl-vendor={gl_vendor}"));
    }
    if let Some(gl_renderer) = snapshot
        .custom_gl_renderer
        .as_deref()
        .and_then(trim_str_to_option)
    {
        extra_args.push(format!("--custom-gl-renderer={gl_renderer}"));
    }
    if let Some(language) = snapshot.language.as_deref().and_then(trim_str_to_option) {
        extra_args.push(format!("--custom-main-language={language}"));
    }
    if let Some(langs) = snapshot
        .accept_languages
        .as_deref()
        .and_then(trim_str_to_option)
    {
        // accept_languages 格式如 "en-US,en;q=0.9,zh-CN;q=0.8"
        // --custom-languages 需要纯语言列表（不含 q 权重）
        let lang_list: String = langs
            .split(',')
            .filter_map(|part| {
                let lang = part.split(';').next()?.trim();
                if lang.is_empty() {
                    None
                } else {
                    Some(lang)
                }
            })
            .collect::<Vec<_>>()
            .join(",");
        if !lang_list.is_empty() {
            extra_args.push(format!("--custom-languages={lang_list}"));
        }
        extra_args.push(format!("--custom-accept-languages={langs}"));
    }
    if let Some(time_zone) = snapshot.time_zone.as_deref().and_then(trim_str_to_option) {
        extra_args.push(format!("--custom-time-zone={time_zone}"));
    }
    if let Some(touch_points) = snapshot.custom_touch_points {
        extra_args.push(format!("--custom-touch-points={touch_points}"));
        if snapshot.mobile == Some(true) {
            extra_args.push("--touch-events=enabled".to_string());
        }
    }
    if snapshot.mobile == Some(true) {
        extra_args.push("--use-mobile-user-agent".to_string());
    }
    if let Some(width) = snapshot.window_width {
        extra_args.push(format!("--custom-resolution-width={width}"));
    }
    if let Some(height) = snapshot.window_height {
        extra_args.push(format!("--custom-resolution-height={height}"));
    }
    if let (Some(width), Some(height)) = (snapshot.window_width, snapshot.window_height) {
        extra_args.push(format!("--window-size={width},{height}"));
    }
    if let Some(device_scale_factor) = snapshot.device_scale_factor {
        extra_args.push(format!(
            "--custom-resolution-dpr={}",
            format_device_scale_factor(device_scale_factor)
        ));
    }
}

fn apply_fingerprint_resolution_overrides(
    snapshot: &mut ProfileFingerprintSnapshot,
    fingerprint: Option<&crate::models::ProfileFingerprintSettings>,
) {
    let Some(fingerprint) = fingerprint else {
        return;
    };
    if let Some(width) = fingerprint.viewport_width {
        snapshot.window_width = Some(width);
    }
    if let Some(height) = fingerprint.viewport_height {
        snapshot.window_height = Some(height);
    }
    if let Some(device_scale_factor) = fingerprint.device_scale_factor {
        snapshot.device_scale_factor = Some(device_scale_factor);
    }
}

fn source_seed(source: &ProfileFingerprintSource, fingerprint_seed: Option<u32>) -> Option<u32> {
    if fingerprint_seed.is_some() {
        return fingerprint_seed;
    }
    let hint = format!(
        "{}:{}:{}",
        source.platform.as_deref().unwrap_or_default(),
        source.device_preset_id.as_deref().unwrap_or_default(),
        source.browser_version.as_deref().unwrap_or_default()
    );
    Some(stable_seed(&hint))
}

fn format_device_scale_factor(value: f32) -> String {
    let rendered = format!("{value:.3}");
    rendered
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}

fn generate_random_u32(seed_hint: &str) -> u32 {
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    let now_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    now_nanos.hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    seed_hint.hash(&mut hasher);
    (hasher.finish() & u64::from(u32::MAX)) as u32
}

fn stable_seed(seed_hint: &str) -> u32 {
    use std::hash::{Hash, Hasher};

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    seed_hint.hash(&mut hasher);
    (hasher.finish() & u64::from(u32::MAX)) as u32
}

fn resolve_fingerprint_seed(
    profile_id: &str,
    profile_snapshot: &mut Profile,
    profile_service: &crate::services::profile_service::ProfileService,
) -> Result<u32, String> {
    let advanced = profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.advanced.as_ref());
    let random_fingerprint = advanced
        .and_then(|value| value.random_fingerprint)
        .unwrap_or(false);
    if random_fingerprint {
        return Ok(generate_random_u32(profile_id));
    }
    if let Some(seed) = profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.fingerprint.as_ref())
        .and_then(|settings| settings.fingerprint_snapshot.as_ref())
        .and_then(|snapshot| snapshot.fingerprint_seed)
    {
        return Ok(seed);
    }
    if let Some(seed) = advanced.and_then(|value| value.fixed_fingerprint_seed) {
        return Ok(seed);
    }

    let fixed_seed = generate_random_u32(profile_id);
    let updated = profile_service
        .set_fixed_fingerprint_seed(profile_id, fixed_seed)
        .map_err(error_to_string)?;
    *profile_snapshot = updated;
    Ok(fixed_seed)
}

fn proxy_to_arg(proxy: &Proxy) -> Result<String, String> {
    match proxy.protocol.as_str() {
        "http" | "https" | "socks5" => Ok(format!(
            "{}://{}:{}",
            proxy.protocol, proxy.host, proxy.port
        )),
        "ssh" => Err(format!(
            "validation failed: ssh proxy is not supported for chromium launch args: {}",
            proxy.id
        )),
        _ => Err(format!(
            "validation failed: unsupported proxy protocol for launch: {}",
            proxy.protocol
        )),
    }
}

fn default_language_from_proxy(proxy: &Proxy) -> Option<String> {
    proxy
        .effective_language
        .as_deref()
        .and_then(trim_str_to_option)
        .or_else(|| {
            proxy
                .suggested_language
                .as_deref()
                .and_then(trim_str_to_option)
        })
        .or_else(|| {
            let country = proxy.country.as_ref()?.trim().to_uppercase();
            crate::services::locale_catalog::default_language_for_country(&country)
        })
}

fn default_timezone_from_proxy(proxy: &Proxy) -> Option<String> {
    proxy
        .effective_timezone
        .as_deref()
        .and_then(trim_str_to_option)
        .or_else(|| {
            proxy
                .suggested_timezone
                .as_deref()
                .and_then(trim_str_to_option)
        })
        .or_else(|| {
            let country = proxy.country.as_ref()?.trim().to_uppercase();
            crate::services::locale_catalog::default_timezone_for_country(&country)
        })
}

fn default_geolocation_from_proxy(proxy: &Proxy) -> Option<GeolocationOverride> {
    Some(GeolocationOverride {
        latitude: proxy.latitude?,
        longitude: proxy.longitude?,
        accuracy: proxy.geo_accuracy_meters,
    })
}

fn trim_to_option(input: String) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn trim_str_to_option(input: &str) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

/// 从语言代码派生 accept-languages 字符串（用于无 fingerprint snapshot 时的回退）
/// 例：en-US → "en-US,en;q=0.9"；zh-CN → "zh-CN,zh;q=0.9,en;q=0.8"
fn derive_accept_languages(language: &str) -> String {
    let base = language.split('-').next().unwrap_or(language);
    if base == language {
        language.to_string()
    } else if base == "en" {
        format!("{language},{base};q=0.9")
    } else {
        format!("{language},{base};q=0.9,en;q=0.8")
    }
}

fn normalize_startup_urls(
    startup_urls: Option<Vec<String>>,
    legacy_startup_url: Option<String>,
) -> Result<Option<Vec<String>>, ()> {
    let mut normalized = startup_urls
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| trim_to_option(value))
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        if let Some(legacy) = legacy_startup_url.and_then(trim_to_option) {
            normalized.push(legacy);
        }
    }

    if normalized.is_empty() {
        return Ok(None);
    }

    for startup_url in &normalized {
        if !startup_url.starts_with("http://") && !startup_url.starts_with("https://") {
            return Err(());
        }
    }

    Ok(Some(normalized))
}

pub(crate) fn do_close_profile(state: &AppState, profile_id: &str) -> Result<Profile, String> {
    logger::info(
        "profile_cmd",
        format!("do_close_profile start profile_id={profile_id}"),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| "engine session service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    profile_service
        .ensure_profile_closable(profile_id)
        .map_err(error_to_string)?;

    if engine_manager.is_running(profile_id) {
        logger::info(
            "profile_cmd",
            format!("do_close_profile engine_manager session found profile_id={profile_id}"),
        );
        engine_manager
            .close_profile(profile_id)
            .map_err(error_to_string)?;
    } else if let Some(session) = engine_session_service
        .get_session(profile_id)
        .map_err(error_to_string)?
    {
        if let Some(pid) = session.pid {
            if runtime_guard::is_process_alive(pid) {
                logger::warn(
                    "profile_cmd",
                    format!(
                        "do_close_profile found alive process outside manager profile_id={profile_id} pid={pid}, sending terminate"
                    ),
                );
                runtime_guard::terminate_process(pid);
            }
        }
    }
    engine_session_service
        .delete_session(profile_id)
        .map_err(error_to_string)?;
    stop_profile_proxy_runtime_quietly(state, profile_id);

    let profile = profile_service
        .mark_profile_running(profile_id, false)
        .map_err(error_to_string)?;
    logger::info(
        "profile_cmd",
        format!("do_close_profile success profile_id={profile_id}"),
    );
    Ok(profile)
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}

fn stop_profile_proxy_runtime_quietly(state: &AppState, profile_id: &str) {
    let mut local_api_server = state.lock_local_api_server();
    if let Err(err) = local_api_server.stop_proxy_runtime(profile_id) {
        logger::warn(
            "profile_cmd",
            format!("proxy daemon stop failed profile_id={profile_id} err={err}"),
        );
    }
}

/// 查询本机公网 IP 的地理建议（语言 / 时区），用于无代理场景下档案表单预填。
/// 结果使用进程内缓存（15 分钟 TTL）；第一次调用会触发后台请求。
#[tauri::command]
pub async fn host_locale_suggestion(
    state: tauri::State<'_, AppState>,
) -> Result<crate::services::host_locale_service::HostLocaleSuggestion, String> {
    Ok(state.host_locale_service.fetch_now().await)
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::Mutex;
    use std::thread;
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
    const TEST_BROWSER_VERSION: &str = "144.0.7559.97";

    use sea_orm::ConnectionTrait;
    use serde_json::json;

    use super::*;
    use crate::db;
    use crate::engine_manager::EngineManager;
    use crate::local_api_server::LocalApiServer;
    use crate::models::{
        CookieStateFile, CreateProfileRequest, CreateProxyRequest, EngineSession,
        ExportProfileCookiesMode, ExportProfileCookiesRequest, GeolocationOverride, ManagedCookie,
        OpenProfileOptions, ProfileAdvancedSettings, ProfilePluginSelection, ProfileSettings,
        Proxy, ProxyLifecycle, SavePluginPackageInput, WebRtcMode,
    };
    use crate::services::app_preference_service::AppPreferenceService;
    use crate::services::automation_service::AutomationService;
    use crate::services::chromium_magic_adapter_service::ChromiumMagicAdapterService;
    use crate::services::device_preset_service::DevicePresetService;
    use crate::services::engine_session_service::EngineSessionService;
    use crate::services::plugin_package_service::PluginPackageService;
    use crate::services::profile_group_service::ProfileGroupService;
    use crate::services::profile_service::ProfileService;
    use crate::services::proxy_service::ProxyService;
    use crate::services::resource_service::ResourceService;
    use crate::services::sync_manager_service::SyncManagerService;

    fn new_test_state() -> AppState {
        let db = db::init_test_database().expect("init test db");
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let profile_service = ProfileService::from_db(db.clone());
        let device_preset_service = DevicePresetService::from_db(db.clone());
        let plugin_package_service = PluginPackageService::from_db(db.clone());
        let engine_session_service = EngineSessionService::from_db(db.clone());
        let proxy_service = ProxyService::from_db(db.clone());
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let resource_dir =
            std::env::temp_dir().join(format!("multi-flow-resource-cmd-test-{unique}"));
        let resource_service =
            ResourceService::from_data_dir(&resource_dir).expect("resource service");
        let app_preference_service = AppPreferenceService::from_data_dir(resource_dir.clone());
        let profiles_root = std::env::temp_dir().join(format!("multi-flow-profile-root-{unique}"));
        std::fs::create_dir_all(&profiles_root).expect("profiles root");
        let mut local_api_server = LocalApiServer::new("127.0.0.1:18180");
        local_api_server.mark_started();

        AppState {
            active_runs: std::sync::Arc::new(
                crate::services::automation_context::ActiveRunRegistry::new(),
            ),
            active_run_channels: Mutex::new(std::collections::HashMap::new()),
            cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            ai_dialog_channels: Mutex::new(std::collections::HashMap::new()),
            tool_confirmation_channels: Mutex::new(std::collections::HashMap::new()),
            chat_service: Mutex::new(crate::services::chat_service::ChatService::from_db(
                db.clone(),
            )),
            chat_cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            automation_service: Mutex::new(AutomationService::from_db(db.clone())),
            profile_group_service: Mutex::new(profile_group_service),
            profile_service: Mutex::new(profile_service),
            device_preset_service: Mutex::new(device_preset_service),
            app_preference_service: Mutex::new(app_preference_service),
            plugin_package_service: Mutex::new(plugin_package_service),
            engine_session_service: Mutex::new(engine_session_service),
            proxy_service: Mutex::new(proxy_service),
            resource_service: Mutex::new(resource_service),
            active_resource_downloads: Mutex::new(std::collections::HashMap::new()),
            active_plugin_downloads: Mutex::new(std::collections::HashMap::new()),
            engine_manager: Mutex::new(EngineManager::with_profiles_root(profiles_root)),
            local_api_server: Mutex::new(local_api_server),
            chromium_magic_adapter_service: Mutex::new(ChromiumMagicAdapterService::new()),
            sync_manager_service: Mutex::new(SyncManagerService::new_mock(None, None)),
            mcp_manager: std::sync::Arc::new(crate::services::mcp::McpManager::from_db(db.clone())),
            bookmark_template_service: Mutex::new(
                crate::services::bookmark_template_service::BookmarkTemplateService::from_db(
                    db.clone(),
                ),
            ),
            require_real_engine: false,
            last_arrangement_snapshot: Mutex::new(Vec::new()),
            host_locale_service: std::sync::Arc::new(
                crate::services::host_locale_service::HostLocaleService::new(|| None),
            ),
        }
    }

    fn new_test_device_preset_service() -> DevicePresetService {
        let db = db::init_test_database().expect("init test db");
        DevicePresetService::from_db(db)
    }

    fn spawn_cookie_export_magic_server() -> (u16, thread::JoinHandle<usize>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind cookie export magic server");
        listener
            .set_nonblocking(true)
            .expect("set nonblocking cookie export magic server");
        let port = listener.local_addr().expect("listener addr").port();
        let handle = thread::spawn(move || {
            let started_at = Instant::now();
            let mut handled_requests = 0usize;
            loop {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let mut buffer = Vec::new();
                        let mut chunk = [0u8; 4096];
                        let mut expected_total = None::<usize>;
                        loop {
                            let bytes_read = stream.read(&mut chunk).expect("read request");
                            if bytes_read == 0 {
                                break;
                            }
                            buffer.extend_from_slice(&chunk[..bytes_read]);
                            if expected_total.is_none() {
                                if let Some(header_end) =
                                    buffer.windows(4).position(|item| item == b"\r\n\r\n")
                                {
                                    let header_text =
                                        String::from_utf8_lossy(&buffer[..header_end + 4]);
                                    let content_length = header_text
                                        .lines()
                                        .find_map(|line| {
                                            line.to_ascii_lowercase()
                                                .strip_prefix("content-length:")
                                                .and_then(|value| {
                                                    value.trim().parse::<usize>().ok()
                                                })
                                        })
                                        .unwrap_or(0);
                                    expected_total = Some(header_end + 4 + content_length);
                                }
                            }
                            if expected_total.is_some_and(|total| buffer.len() >= total) {
                                break;
                            }
                        }
                        let body = r#"{"status":"ok","data":{"environment_id":"pf_close_snapshot","managed_cookies":[{"cookie_id":"ck_1","url":"https://example.com/","name":"sid","value":"abc"}]}}"#;
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        stream
                            .write_all(response.as_bytes())
                            .expect("write response");
                        handled_requests += 1;
                        break;
                    }
                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                        if started_at.elapsed() >= Duration::from_millis(500) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(err) => panic!("accept request: {err}"),
                }
            }
            handled_requests
        });
        (port, handle)
    }

    #[test]
    fn bound_proxy_locale_refresh_overwrites_profile_locale() {
        let state = new_test_state();
        let profile = {
            let profile_service = state.lock_profile_service();
            profile_service
                .create_profile(CreateProfileRequest {
                    name: "locale-binding-target".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };
        let proxy = {
            let proxy_service = state.lock_proxy_service();
            let proxy = proxy_service
                .create_proxy(CreateProxyRequest {
                    name: "locale-proxy".to_string(),
                    protocol: "http".to_string(),
                    host: "127.0.0.1".to_string(),
                    port: 8080,
                    username: None,
                    password: None,
                    provider: None,
                    note: None,
                    expires_at: None,
                    language_source: Some("custom".to_string()),
                    custom_language: Some("de-DE".to_string()),
                    timezone_source: Some("custom".to_string()),
                    custom_timezone: Some("Europe/Berlin".to_string()),
                })
                .expect("create proxy");
            proxy_service
                .bind_profile_proxy(&profile.id, &proxy.id)
                .expect("bind proxy");
            proxy
        };

        let updated = refresh_profile_locale_for_bound_proxy(&state, &profile.id, &proxy.id)
            .expect("refresh locale from proxy");
        let snapshot = updated
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .and_then(|fingerprint| fingerprint.fingerprint_snapshot.as_ref())
            .expect("fingerprint snapshot");

        assert_eq!(snapshot.language.as_deref(), Some("de-DE"));
        assert_eq!(snapshot.time_zone.as_deref(), Some("Europe/Berlin"));
    }

    #[test]
    fn profile_lifecycle_and_engine_guard_work_end_to_end() {
        let state = new_test_state();

        {
            let service = state
                .profile_group_service
                .lock()
                .expect("group service lock");
            service
                .create_group(crate::models::CreateProfileGroupRequest {
                    name: "g-lifecycle".to_string(),
                    note: None,
                    browser_bg_color: None,
                    toolbar_label_mode: None,
                })
                .expect("create lifecycle group");
        }

        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "lifecycle-target".to_string(),
                    group: Some("g-lifecycle".to_string()),
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };

        let opened = do_open_profile(&state, None, None, &profile.id, None).expect("open profile");
        assert_eq!(opened.profile.id, profile.id);
        {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            assert!(engine_manager.is_running(&profile.id));
        }

        let reopen_err = do_open_profile(&state, None, None, &profile.id, None)
            .expect_err("open twice should fail");
        assert!(reopen_err.contains("already running"));

        let closed = do_close_profile(&state, &profile.id).expect("close profile");
        assert!(!closed.running);
        {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            assert!(!engine_manager.is_running(&profile.id));
        }

        let reclose_err =
            do_close_profile(&state, &profile.id).expect_err("close twice should fail");
        assert!(reclose_err.contains("not running"));

        do_open_profile(&state, None, None, &profile.id, None).expect("re-open profile");
        {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            assert!(engine_manager.is_running(&profile.id));
        }

        let deleted = do_delete_profile(&state, &profile.id).expect("delete profile");
        assert!(!deleted.running);
        assert!(matches!(
            deleted.lifecycle,
            crate::models::ProfileLifecycle::Deleted
        ));
        {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            assert!(!engine_manager.is_running(&profile.id));
        }

        let open_deleted_err = do_open_profile(&state, None, None, &profile.id, None)
            .expect_err("deleted profile cannot open");
        assert!(open_deleted_err.contains("already deleted"));

        {
            let service = state.profile_service.lock().expect("profile service lock");
            let restored = service
                .restore_profile(&profile.id)
                .expect("restore profile");
            assert!(matches!(
                restored.lifecycle,
                crate::models::ProfileLifecycle::Active
            ));
            assert!(!restored.running);
        }

        let reopened =
            do_open_profile(&state, None, None, &profile.id, None).expect("open after restore");
        assert!(reopened.profile.running);
    }

    #[test]
    fn get_profile_runtime_details_returns_profile_dirs_when_not_running() {
        let state = new_test_state();
        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "runtime-detail".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };

        let details = build_profile_runtime_details(&state, &profile.id).expect("runtime details");

        assert!(details.profile_root_dir.ends_with(&profile.id));
        assert!(details
            .user_data_dir
            .ends_with(&format!("{}/user-data", profile.id)));
        assert!(details
            .cache_data_dir
            .ends_with(&format!("{}/cache-data", profile.id)));
        assert!(details.runtime_handle.is_none());
        assert!(details.launch_args.is_none());
    }

    #[test]
    fn clear_profile_cache_recreates_directory_and_rejects_running_profile() {
        let state = new_test_state();
        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "cache-profile".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };

        let (_, _, cache_dir) = state
            .engine_manager
            .lock()
            .expect("engine manager lock")
            .profile_data_dirs(&profile.id)
            .expect("cache dir");
        std::fs::create_dir_all(&cache_dir).expect("create cache dir");
        std::fs::write(cache_dir.join("temp.bin"), b"cache").expect("write cache");

        let response = clear_profile_cache_inner(&state, &profile.id).expect("clear cache");
        assert_eq!(response.profile_id, profile.id);
        assert!(cache_dir.exists());
        assert!(!cache_dir.join("temp.bin").exists());

        let _ = do_open_profile(&state, None, None, &profile.id, None).expect("open profile");
        let err = clear_profile_cache_inner(&state, &profile.id)
            .expect_err("running profile should reject");
        assert!(err.contains("不能清理 cache"));
    }

    #[test]
    fn read_profile_cookies_reads_local_cookie_file_for_stopped_profile() {
        let state = new_test_state();
        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "cookie-reader".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };
        let cookie_path = resolve_profile_cookie_state_path(
            &state.engine_manager.lock().expect("engine manager lock"),
            &profile.id,
        )
        .expect("cookie path");
        write_cookie_state_file(
            cookie_path.parent().expect("cookie parent"),
            &CookieStateFile {
                environment_id: Some(profile.id.clone()),
                managed_cookies: vec![ManagedCookie {
                    cookie_id: "ck_1".to_string(),
                    url: "https://example.com/".to_string(),
                    name: "sid".to_string(),
                    value: "abc".to_string(),
                    domain: Some(".example.com".to_string()),
                    path: Some("/".to_string()),
                    secure: Some(true),
                    http_only: Some(true),
                    same_site: Some("none".to_string()),
                    expires: None,
                }],
            },
        )
        .expect("write cookie state");

        let response = read_profile_cookies_inner(&state, &profile.id).expect("read cookies");

        assert_eq!(response.cookie_count, 1);
        assert_eq!(response.site_urls, vec!["https://example.com/"]);
        assert!(response.json.contains("\"managed_cookies\""));
    }

    #[test]
    fn prepare_cookie_state_file_migrates_legacy_cookie_state_into_profile_cookie_dir() {
        let state = new_test_state();
        let profile_id = "pf_cookie_migrate";
        let settings = ProfileSettings {
            advanced: Some(crate::models::ProfileAdvancedSettings {
                cookie_state_json: Some(
                    r#"{
  "managed_cookies": [
    {
      "cookie_id": "ck_legacy",
      "url": "https://legacy.example.com/",
      "name": "sid",
      "value": "legacy"
    }
  ]
}"#
                    .to_string(),
                ),
                ..Default::default()
            }),
            ..Default::default()
        };

        let path = prepare_cookie_state_file(
            profile_id,
            Some(&settings),
            &state.engine_manager.lock().expect("engine manager lock"),
        )
        .expect("prepare cookie state file")
        .expect("cookie path");

        assert!(path.ends_with(&format!("{profile_id}/cookies/cookie-state.json")));
        let written = std::fs::read_to_string(&path).expect("read cookie state");
        assert!(written.contains("\"environment_id\": \"pf_cookie_migrate\""));
        assert!(written.contains("\"ck_legacy\""));
    }

    #[test]
    fn prepare_extension_state_file_generates_profile_extension_state_from_plugin_selections() {
        let state = new_test_state();
        let package_dir = std::env::temp_dir().join("multi-flow-plugin-test-pkg");
        std::fs::create_dir_all(&package_dir).expect("create plugin test dir");
        let crx_path = package_dir.join("demo.crx");
        std::fs::write(&crx_path, b"crx").expect("write demo crx");

        {
            let service = state
                .plugin_package_service
                .lock()
                .expect("plugin package service lock");
            service
                .save_package(SavePluginPackageInput {
                    package_id: "pkg_demo".to_string(),
                    extension_id: "abcdefghijklmnopabcdefghijklmnop".to_string(),
                    name: "Demo Plugin".to_string(),
                    version: "1.2.3".to_string(),
                    description: Some("demo".to_string()),
                    icon_path: None,
                    crx_path: crx_path.to_string_lossy().to_string(),
                    source_type: "crx".to_string(),
                    store_url: None,
                    update_url: None,
                    latest_version: Some("1.2.3".to_string()),
                    update_status: Some("up_to_date".to_string()),
                })
                .expect("save plugin package");
        }

        let settings = ProfileSettings {
            advanced: Some(ProfileAdvancedSettings {
                plugin_selections: Some(vec![ProfilePluginSelection {
                    package_id: "pkg_demo".to_string(),
                    enabled: true,
                }]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let path = prepare_extension_state_file(
            &state,
            "pf_extension_state",
            Some(&settings),
            &state.engine_manager.lock().expect("engine manager lock"),
        )
        .expect("prepare extension state file")
        .expect("extension path");

        assert!(path.ends_with("pf_extension_state/extensions/extension-state.json"));
        let written = std::fs::read_to_string(path).expect("read extension state");
        assert!(written.contains("\"managed_extensions\""));
        assert!(written.contains("\"package_id\": \"pkg_demo\""));
        assert!(written.contains("\"source_type\": \"crx\""));
    }

    #[test]
    fn export_profile_cookies_writes_selected_path_for_stopped_profile() {
        let state = new_test_state();
        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "cookie-exporter".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };
        let cookie_path = resolve_profile_cookie_state_path(
            &state.engine_manager.lock().expect("engine manager lock"),
            &profile.id,
        )
        .expect("cookie path");
        write_cookie_state_file(
            cookie_path.parent().expect("cookie parent"),
            &CookieStateFile {
                environment_id: Some(profile.id.clone()),
                managed_cookies: vec![ManagedCookie {
                    cookie_id: "ck_1".to_string(),
                    url: "https://example.com/".to_string(),
                    name: "sid".to_string(),
                    value: "abc".to_string(),
                    domain: Some(".example.com".to_string()),
                    path: Some("/".to_string()),
                    secure: Some(true),
                    http_only: Some(true),
                    same_site: Some("none".to_string()),
                    expires: None,
                }],
            },
        )
        .expect("write cookie state");
        let export_path = std::env::temp_dir().join(format!("{}-cookie-export.json", profile.id));
        if export_path.exists() {
            std::fs::remove_file(&export_path).expect("remove old export");
        }

        let response = export_profile_cookies_inner(
            &state,
            &profile.id,
            ExportProfileCookiesRequest {
                mode: ExportProfileCookiesMode::All,
                url: None,
                export_path: Some(export_path.to_string_lossy().to_string()),
            },
        )
        .expect("export cookies");

        assert_eq!(response.path, export_path.to_string_lossy());
        let exported = std::fs::read_to_string(export_path).expect("read export");
        assert!(exported.contains("\"managed_cookies\""));
        assert!(exported.contains("\"ck_1\""));
    }

    #[test]
    fn write_cookie_state_file_creates_runtime_cookie_state_json() {
        let state = new_test_state();
        let profile_id = "pf_cookie_state";
        let runtime_dir = state
            .engine_manager
            .lock()
            .expect("engine manager lock")
            .profile_data_dirs(profile_id)
            .expect("profile dirs")
            .0
            .join("runtime");

        let path = write_cookie_state_file(
            &runtime_dir,
            &CookieStateFile {
                environment_id: Some(profile_id.to_string()),
                managed_cookies: vec![ManagedCookie {
                    cookie_id: "ck_1".to_string(),
                    url: "https://example.com/".to_string(),
                    name: "sid".to_string(),
                    value: "abc".to_string(),
                    domain: Some(".example.com".to_string()),
                    path: Some("/".to_string()),
                    secure: Some(true),
                    http_only: Some(true),
                    same_site: Some("none".to_string()),
                    expires: None,
                }],
            },
        )
        .expect("write cookie state file");

        assert!(path.ends_with("cookie-state.json"));
        let written = std::fs::read_to_string(path).expect("read cookie state");
        assert!(written.contains("\"managed_cookies\""));
        assert!(written.contains("\"environment_id\""));
    }

    #[test]
    fn collect_cookie_site_urls_returns_unique_sorted_urls() {
        let sites = collect_cookie_site_urls(&CookieStateFile {
            environment_id: Some("env_1".to_string()),
            managed_cookies: vec![
                ManagedCookie {
                    cookie_id: "ck_1".to_string(),
                    url: "https://example.com/path".to_string(),
                    name: "sid".to_string(),
                    value: "1".to_string(),
                    domain: None,
                    path: None,
                    secure: None,
                    http_only: None,
                    same_site: None,
                    expires: None,
                },
                ManagedCookie {
                    cookie_id: "ck_2".to_string(),
                    url: "https://accounts.example.com/".to_string(),
                    name: "token".to_string(),
                    value: "2".to_string(),
                    domain: None,
                    path: None,
                    secure: None,
                    http_only: None,
                    same_site: None,
                    expires: None,
                },
                ManagedCookie {
                    cookie_id: "ck_3".to_string(),
                    url: "https://example.com/another".to_string(),
                    name: "sid2".to_string(),
                    value: "3".to_string(),
                    domain: None,
                    path: None,
                    secure: None,
                    http_only: None,
                    same_site: None,
                    expires: None,
                },
            ],
        });

        assert_eq!(
            sites,
            vec![
                "https://accounts.example.com/".to_string(),
                "https://example.com/".to_string()
            ]
        );
    }

    #[test]
    fn batch_set_profile_group_reports_success_and_failure() {
        let state = new_test_state();

        {
            let service = state
                .profile_group_service
                .lock()
                .expect("group service lock");
            service
                .create_group(crate::models::CreateProfileGroupRequest {
                    name: "growth".to_string(),
                    note: None,
                    browser_bg_color: None,
                    toolbar_label_mode: None,
                })
                .expect("create growth group");
        }

        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "group-target".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile")
        };

        let response = do_batch_set_profile_group(
            &state,
            crate::models::BatchSetProfileGroupRequest {
                profile_ids: vec![profile.id.clone(), "pf_missing".to_string()],
                group_name: Some("growth".to_string()),
            },
        )
        .expect("batch set group");

        assert_eq!(response.total, 2);
        assert_eq!(response.success_count, 1);
        assert_eq!(response.failed_count, 1);
    }

    #[test]
    fn resolve_launch_options_derives_proxy_defaults() {
        let proxy = Proxy {
            id: "px_000001".to_string(),
            name: "proxy-us".to_string(),
            protocol: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: 8080,
            username: None,
            password: None,
            country: Some("US".to_string()),
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: Some("ok".to_string()),
            check_message: None,
            last_checked_at: None,
            exit_ip: Some("8.8.8.8".to_string()),
            latitude: Some(37.7749),
            longitude: Some(-122.4194),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
            language_source: Some("ip".to_string()),
            custom_language: None,
            effective_language: Some("en-US".to_string()),
            timezone_source: Some("ip".to_string()),
            custom_timezone: None,
            effective_timezone: Some("America/Los_Angeles".to_string()),
            target_site_checks: None,
            expires_at: None,
            lifecycle: ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };

        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            OpenProfileOptions::default(),
            Some(&proxy),
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");
        assert_eq!(options.language.as_deref(), Some("en-US"));
        assert_eq!(options.timezone_id.as_deref(), Some("America/Los_Angeles"));
        assert_eq!(
            options.proxy_server.as_deref(),
            Some("http://127.0.0.1:8080")
        );
        assert_eq!(options.web_rtc_policy, None);
        assert!(options.startup_urls.is_empty());
    }

    #[test]
    fn command_launch_flow_applies_resolved_profile_visuals() {
        let db = db::init_test_database().expect("init test db");
        let preset_service = DevicePresetService::from_db(db.clone());
        let group_service = ProfileGroupService::from_db(db.clone());
        let profile_service = ProfileService::from_db(db.clone());

        group_service
            .create_group(crate::models::CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create group");

        crate::runtime_compat::block_on_compat(db.execute_unprepared(
            "UPDATE profile_groups SET browser_bg_color = '#0F8A73', toolbar_label_mode = 'group_name_and_id' WHERE name = 'growth'",
        ))
        .expect("seed group visual defaults");

        let inherited = profile_service
            .create_profile(CreateProfileRequest {
                name: "alpha".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create inherited profile");

        let inherited = profile_service
            .get_profile(&inherited.id)
            .expect("reload inherited profile");
        let mut inherited_options = resolve_launch_options(
            &preset_service,
            &inherited.id,
            &inherited.name,
            inherited.settings.as_ref(),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve inherited launch options");
        inherited_options.toolbar_text = inherited.resolved_toolbar_text.clone();
        inherited_options.background_color = inherited.resolved_browser_bg_color.clone();
        inherited_options.dock_icon_text = inherited.resolved_toolbar_text.clone();
        assert_eq!(inherited_options.toolbar_text.as_deref(), Some("growth-1"));
        assert_eq!(
            inherited_options.background_color.as_deref(),
            Some("#0F8A73")
        );
        assert_eq!(
            inherited_options.dock_icon_text.as_deref(),
            Some("growth-1")
        );

        let overridden = profile_service
            .create_profile(CreateProfileRequest {
                name: "beta".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create overridden profile");

        crate::runtime_compat::block_on_compat(db.execute_unprepared(
            "UPDATE profiles SET settings_json = '{\"basic\":{\"browserBgColorMode\":\"none\",\"toolbarLabelMode\":\"id_only\"}}' WHERE id = 2",
        ))
        .expect("seed profile visual override");

        let overridden = profile_service
            .get_profile(&overridden.id)
            .expect("reload overridden profile");
        let mut overridden_options = resolve_launch_options(
            &preset_service,
            &overridden.id,
            &overridden.name,
            overridden.settings.as_ref(),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve overridden launch options");
        overridden_options.toolbar_text = overridden.resolved_toolbar_text.clone();
        overridden_options.background_color = overridden.resolved_browser_bg_color.clone();
        overridden_options.dock_icon_text = overridden.resolved_toolbar_text.clone();
        assert_eq!(overridden_options.toolbar_text.as_deref(), Some("2"));
        assert_eq!(overridden_options.background_color, None);
        assert_eq!(overridden_options.dock_icon_text.as_deref(), Some("2"));
    }

    #[test]
    fn resolve_launch_options_prefers_proxy_effective_values() {
        let proxy = Proxy {
            id: "px_000001".to_string(),
            name: "proxy-us".to_string(),
            protocol: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: 8080,
            username: None,
            password: None,
            country: Some("US".to_string()),
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: Some("ok".to_string()),
            check_message: None,
            last_checked_at: None,
            exit_ip: Some("8.8.8.8".to_string()),
            latitude: Some(37.7749),
            longitude: Some(-122.4194),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
            language_source: Some("custom".to_string()),
            custom_language: Some("de-DE".to_string()),
            effective_language: Some("de-DE".to_string()),
            timezone_source: Some("custom".to_string()),
            custom_timezone: Some("Europe/Berlin".to_string()),
            effective_timezone: Some("Europe/Berlin".to_string()),
            target_site_checks: None,
            expires_at: None,
            lifecycle: ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };

        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            OpenProfileOptions::default(),
            Some(&proxy),
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert_eq!(options.language.as_deref(), Some("de-DE"));
        assert_eq!(options.timezone_id.as_deref(), Some("Europe/Berlin"));
    }

    #[test]
    fn resolve_launch_options_validates_geolocation_range() {
        let preset_service = new_test_device_preset_service();
        let err = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            OpenProfileOptions {
                geolocation: Some(GeolocationOverride {
                    latitude: 91.0,
                    longitude: 0.0,
                    accuracy: None,
                }),
                web_rtc_mode: Some(WebRtcMode::Real),
                ..Default::default()
            },
            None,
            None,
            None,
            None,
            None,
        )
        .expect_err("invalid geolocation should fail");
        assert!(err.contains("invalid latitude"));
    }

    #[test]
    fn resolve_web_rtc_override_ip_prefers_proxy_exit_ip_for_follow_ip_mode() {
        let proxy = Proxy {
            id: "px_000001".to_string(),
            name: "proxy-us".to_string(),
            protocol: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: 8080,
            username: None,
            password: None,
            country: Some("US".to_string()),
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: Some("ok".to_string()),
            check_message: None,
            last_checked_at: None,
            exit_ip: Some("203.0.113.10".to_string()),
            latitude: Some(37.7749),
            longitude: Some(-122.4194),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
            language_source: Some("ip".to_string()),
            custom_language: None,
            effective_language: Some("en-US".to_string()),
            timezone_source: Some("ip".to_string()),
            custom_timezone: None,
            effective_timezone: Some("America/Los_Angeles".to_string()),
            target_site_checks: None,
            expires_at: None,
            lifecycle: ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };

        let ip = resolve_web_rtc_override_ip_with(
            "pf_000001",
            WebRtcMode::FollowIp,
            None,
            Some(&proxy),
            || Ok("198.51.100.5".to_string()),
        )
        .expect("resolve web rtc override ip");

        assert_eq!(ip.as_deref(), Some("203.0.113.10"));
    }

    #[test]
    fn resolve_web_rtc_override_ip_falls_back_to_local_public_ip_for_follow_ip_mode() {
        let ip =
            resolve_web_rtc_override_ip_with("pf_000001", WebRtcMode::FollowIp, None, None, || {
                Ok("198.51.100.5".to_string())
            })
            .expect("resolve web rtc override ip");

        assert_eq!(ip.as_deref(), Some("198.51.100.5"));
    }

    #[test]
    fn resolve_launch_options_uses_chromium_geolocation_switches_for_custom_mode() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "geolocationMode": "custom",
            "geolocation": {
                "latitude": 31.2304,
                "longitude": 121.4737,
                "accuracy": 15.5
            }
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-latitude=31.2304"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-longitude=121.4737"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-accuracy=15.5"));
        assert!(resolved
            .extra_args
            .iter()
            .all(|arg| !arg.starts_with("--multi-flow-geolocation=")));
    }

    #[test]
    fn resolve_launch_options_adds_auto_allow_geolocation_switch() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "geolocationMode": "off",
            "autoAllowGeolocation": true
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--auto-allow-geolocation"));
    }

    #[test]
    fn resolve_launch_options_adds_enable_do_not_track_switch() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "doNotTrackEnabled": true
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--enable-do-not-track"));
    }

    #[test]
    fn resolve_launch_options_enables_dns_leak_protection_when_proxy_bound() {
        let preset_service = new_test_device_preset_service();
        let proxy = Proxy {
            id: "px_000001".to_string(),
            name: "proxy-us".to_string(),
            protocol: "socks5".to_string(),
            host: "127.0.0.1".to_string(),
            port: 1080,
            username: None,
            password: None,
            country: Some("US".to_string()),
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: Some("ok".to_string()),
            check_message: None,
            last_checked_at: None,
            exit_ip: Some("203.0.113.10".to_string()),
            latitude: Some(37.7749),
            longitude: Some(-122.4194),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
            language_source: Some("ip".to_string()),
            custom_language: None,
            effective_language: Some("en-US".to_string()),
            timezone_source: Some("ip".to_string()),
            custom_timezone: None,
            effective_timezone: Some("America/Los_Angeles".to_string()),
            target_site_checks: None,
            expires_at: None,
            lifecycle: ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            OpenProfileOptions::default(),
            Some(&proxy),
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert_eq!(
            resolved.proxy_server.as_deref(),
            Some("socks5://127.0.0.1:1080")
        );
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--enable-dns-leak-protection"));
    }

    #[test]
    fn resolve_launch_options_maps_legacy_disable_images_to_custom_image_block() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "disableImages": true
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert_eq!(resolved.disable_images, false);
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-image-loading-mode=block"));
    }

    #[test]
    fn resolve_launch_options_adds_image_max_area_switches() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "imageLoadingMode": "max-area",
            "imageMaxArea": 4096
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-image-loading-mode=max-area"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-image-max-area=4096"));
    }

    #[test]
    fn resolve_launch_options_adds_custom_device_identity_switches() {
        let preset_service = new_test_device_preset_service();
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "deviceNameMode": "custom",
            "customDeviceName": "device-a1b2c3d4",
            "macAddressMode": "custom",
            "customMacAddress": "A2:11:22:33:44:55"
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-host-name=device-a1b2c3d4"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-mac-address=A2:11:22:33:44:55"));
    }

    #[test]
    fn resolve_launch_options_prefers_proxy_geolocation_in_ip_mode() {
        let preset_service = new_test_device_preset_service();
        let proxy = Proxy {
            id: "px_000001".to_string(),
            name: "proxy-us".to_string(),
            protocol: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: 8080,
            username: None,
            password: None,
            country: Some("US".to_string()),
            region: None,
            city: None,
            provider: None,
            note: None,
            check_status: Some("ok".to_string()),
            check_message: None,
            last_checked_at: None,
            exit_ip: Some("8.8.8.8".to_string()),
            latitude: Some(37.7749),
            longitude: Some(-122.4194),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
            language_source: Some("ip".to_string()),
            custom_language: None,
            effective_language: Some("en-US".to_string()),
            timezone_source: Some("ip".to_string()),
            custom_timezone: None,
            effective_timezone: Some("America/Los_Angeles".to_string()),
            target_site_checks: None,
            expires_at: None,
            lifecycle: ProxyLifecycle::Active,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };
        let options: OpenProfileOptions = serde_json::from_value(json!({
            "geolocationMode": "ip"
        }))
        .expect("deserialize open options");

        let resolved = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            options,
            Some(&proxy),
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");

        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-latitude=37.7749"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-longitude=-122.4194"));
        assert!(resolved
            .extra_args
            .iter()
            .any(|arg| arg == "--custom-geolocation-accuracy=20"));
    }

    #[test]
    fn resolve_launch_options_validates_startup_url_scheme() {
        let preset_service = new_test_device_preset_service();
        let err = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            None,
            OpenProfileOptions {
                startup_urls: Some(vec!["ftp://example.com".to_string()]),
                ..Default::default()
            },
            None,
            None,
            None,
            None,
            None,
        )
        .expect_err("invalid startup url should fail");
        assert!(err.contains("invalid startupUrl"));
    }

    #[test]
    fn resolve_launch_options_keeps_multiple_startup_urls_in_order() {
        let preset_service = new_test_device_preset_service();
        let settings = ProfileSettings {
            basic: Some(crate::models::ProfileBasicSettings {
                startup_urls: Some(vec![
                    "https://example.com".to_string(),
                    "https://example.org/path".to_string(),
                ]),
                ..Default::default()
            }),
            ..Default::default()
        };
        let merged = merge_open_options(Some(&settings), None);
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            Some(&settings),
            merged,
            None,
            None,
            None,
            None,
            None,
        )
        .expect("resolve launch options");
        assert_eq!(
            options.startup_urls,
            vec![
                "https://example.com".to_string(),
                "https://example.org/path".to_string()
            ]
        );
    }

    #[test]
    fn resolve_launch_options_carries_snapshot_hardware_and_fonts() {
        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            Some(&ProfileSettings {
                basic: Some(crate::models::ProfileBasicSettings {
                    platform: Some("windows".to_string()),
                    device_preset_id: Some("windows_11_desktop".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                fingerprint: Some(crate::models::ProfileFingerprintSettings {
                    fingerprint_source: Some(ProfileFingerprintSource {
                        platform: Some("windows".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert_eq!(options.custom_cpu_cores, Some(12));
        assert_eq!(options.custom_ram_gb, Some(8));
        assert!(options
            .custom_font_list
            .as_ref()
            .is_some_and(|items| items.iter().any(|item| item == "Segoe UI")));
    }

    #[test]
    fn resolve_launch_options_runtime_overrides_do_not_change_strong_snapshot_fields() {
        let settings = ProfileSettings {
            basic: Some(crate::models::ProfileBasicSettings {
                platform: Some("windows".to_string()),
                device_preset_id: Some("windows_11_desktop".to_string()),
                browser_version: Some("144.0.7559.97".to_string()),
                ..Default::default()
            }),
            fingerprint: Some(crate::models::ProfileFingerprintSettings {
                fingerprint_source: Some(ProfileFingerprintSource {
                    platform: Some("windows".to_string()),
                    device_preset_id: Some("windows_11_desktop".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            Some(&settings),
            OpenProfileOptions {
                language: Some("de-DE".to_string()),
                timezone_id: Some("Europe/Berlin".to_string()),
                ..Default::default()
            },
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert!(options
            .user_agent
            .as_deref()
            .is_some_and(|value| value.contains("Chrome/144.0.0.0")));
        assert_eq!(options.language.as_deref(), Some("de-DE"));
        assert_eq!(options.timezone_id.as_deref(), Some("Europe/Berlin"));
        assert_eq!(options.custom_cpu_cores, Some(12));
        assert_eq!(options.custom_ram_gb, Some(8));
        assert!(options
            .custom_font_list
            .as_ref()
            .is_some_and(|items| items.iter().any(|item| item == "Segoe UI")));
    }

    #[test]
    fn preview_fingerprint_bundle_supports_custom_font_list_mode() {
        let preset_service = new_test_device_preset_service();
        let snapshot = preview_fingerprint_bundle_inner(
            &preset_service,
            ProfileFingerprintSource {
                platform: Some("windows".to_string()),
                device_preset_id: Some("windows_11_desktop".to_string()),
                browser_version: Some("144.0.7559.97".to_string()),
                ..Default::default()
            },
            Some(FontListMode::Custom),
            Some(vec!["Font A".to_string(), "Font B".to_string()]),
            None,
        )
        .expect("preview bundle");

        assert_eq!(
            snapshot.custom_font_list.as_ref(),
            Some(&vec!["Font A".to_string(), "Font B".to_string()])
        );
    }

    #[test]
    fn resolve_launch_options_rerendered_snapshot_keeps_custom_font_list_mode() {
        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "test-profile",
            Some(&ProfileSettings {
                basic: Some(crate::models::ProfileBasicSettings {
                    platform: Some("windows".to_string()),
                    device_preset_id: Some("windows_11_desktop".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                fingerprint: Some(crate::models::ProfileFingerprintSettings {
                    fingerprint_source: Some(ProfileFingerprintSource {
                        platform: Some("windows".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        ..Default::default()
                    }),
                    font_list_mode: Some(FontListMode::Custom),
                    custom_font_list: Some(vec![
                        "Custom UI".to_string(),
                        "Custom Sans".to_string(),
                    ]),
                    fingerprint_snapshot: Some(ProfileFingerprintSnapshot {
                        browser_version: Some("143.0.0.0".to_string()),
                        platform: Some("windows".to_string()),
                        custom_font_list: Some(vec!["Stale Font".to_string()]),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert_eq!(
            options.custom_font_list.as_ref(),
            Some(&vec!["Custom UI".to_string(), "Custom Sans".to_string()])
        );
    }

    #[test]
    fn resolve_launch_options_prefers_profile_resolution_override() {
        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "resolution-profile",
            Some(&ProfileSettings {
                basic: Some(crate::models::ProfileBasicSettings {
                    platform: Some("macos".to_string()),
                    device_preset_id: Some("macos_macbook_pro_14".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                fingerprint: Some(crate::models::ProfileFingerprintSettings {
                    viewport_width: Some(1728),
                    viewport_height: Some(1117),
                    device_scale_factor: Some(1.5),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-width=1728"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-height=1117"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-dpr=1.5"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--window-size=1728,1117"));
        assert!(!options
            .extra_args
            .iter()
            .any(|item| item.starts_with("--force-device-scale-factor=")));
    }

    #[test]
    fn append_snapshot_args_only_enables_mobile_flags_for_mobile_snapshots() {
        let mut extra_args = Vec::new();
        append_snapshot_args(
            &mut extra_args,
            &ProfileFingerprintSnapshot {
                mobile: Some(false),
                custom_touch_points: Some(5),
                window_width: Some(1512),
                window_height: Some(982),
                device_scale_factor: Some(2.0),
                ..Default::default()
            },
        );

        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-touch-points=5"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-resolution-width=1512"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-resolution-height=982"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-resolution-dpr=2"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--window-size=1512,982"));
        assert!(!extra_args
            .iter()
            .any(|item| item == "--touch-events=enabled"));
        assert!(!extra_args
            .iter()
            .any(|item| item == "--use-mobile-user-agent"));
    }

    #[test]
    fn append_snapshot_args_keeps_full_fingerprint_language() {
        let mut extra_args = Vec::new();
        append_snapshot_args(
            &mut extra_args,
            &ProfileFingerprintSnapshot {
                language: Some("cs-CZ".to_string()),
                accept_languages: Some("cs-CZ,cs;q=0.9,en;q=0.8".to_string()),
                ..Default::default()
            },
        );

        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-main-language=cs-CZ"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-languages=cs-CZ,cs,en"));
        assert!(extra_args
            .iter()
            .any(|item| item == "--custom-accept-languages=cs-CZ,cs;q=0.9,en;q=0.8"));
    }

    #[test]
    fn resolve_launch_options_applies_android_mobile_flags() {
        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "android-profile",
            Some(&ProfileSettings {
                basic: Some(crate::models::ProfileBasicSettings {
                    platform: Some("android".to_string()),
                    device_preset_id: Some("android_pixel_8".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--use-mobile-user-agent"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-platform=Linux armv81"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-touch-points=5"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--touch-events=enabled"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-width=412"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-height=915"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-dpr=2.625"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--window-size=412,915"));
        assert!(!options
            .extra_args
            .iter()
            .any(|item| item.starts_with("--force-device-scale-factor=")));
        assert!(options.extra_args.iter().any(|item| {
            item.starts_with("--custom-ua-metadata=platform=Android|platform_version=14.0.0|arch=arm|bitness=64|mobile=1")
                && item.contains("brands=Google Chrome:144,Chromium:144,Not?A_Brand:99")
                && item.contains("ua_full_version=144.0.7559.97")
                && item.ends_with("form_factors=Mobile")
        }));
        assert_eq!(
            options.user_agent.as_deref(),
            Some(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36"
            )
        );
        assert!(options
            .custom_font_list
            .as_ref()
            .is_some_and(|items| items.iter().any(|item| item == "Roboto")));
    }

    #[test]
    fn resolve_launch_options_applies_ios_mobile_flags() {
        let preset_service = new_test_device_preset_service();
        let options = resolve_launch_options(
            &preset_service,
            "pf_000001",
            "ios-profile",
            Some(&ProfileSettings {
                basic: Some(crate::models::ProfileBasicSettings {
                    platform: Some("ios".to_string()),
                    device_preset_id: Some("ios_iphone_15_pro".to_string()),
                    browser_version: Some("144.0.7559.97".to_string()),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            OpenProfileOptions::default(),
            None,
            None,
            None,
            Some("144.0.7559.97"),
            None,
        )
        .expect("resolve launch options");

        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--use-mobile-user-agent"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-platform=iPhone"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-touch-points=5"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--touch-events=enabled"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-width=393"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-height=852"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--custom-resolution-dpr=3"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--window-size=393,852"));
        assert!(!options
            .extra_args
            .iter()
            .any(|item| item.starts_with("--force-device-scale-factor=")));
        assert!(options.extra_args.iter().any(|item| {
            item.starts_with("--custom-ua-metadata=platform=iOS|platform_version=17.0.0|arch=arm|bitness=64|mobile=1")
                && item.contains("brands=Google Chrome:144,Chromium:144,Not?A_Brand:99")
                && item.contains("ua_full_version=144.0.7559.97")
                && item.ends_with("form_factors=Mobile")
        }));
        assert_eq!(
            options.user_agent.as_deref(),
            Some(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/144.0.0.0 Mobile/15E148 Safari/604.1"
            )
        );
        assert!(options
            .custom_font_list
            .as_ref()
            .is_some_and(|items| items.iter().any(|item| item == "Helvetica Neue")));
    }

    #[test]
    fn open_profile_fails_when_real_engine_required_but_chromium_missing() {
        let mut state = new_test_state();
        state.require_real_engine = true;

        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            service
                .create_profile(CreateProfileRequest {
                    name: "no-chromium".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: Some(ProfileSettings {
                        basic: Some(crate::models::ProfileBasicSettings {
                            platform: Some("macos".to_string()),
                            browser_version: Some("999.0.0.0".to_string()),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }),
                })
                .expect("create profile")
        };

        let err = do_open_profile(&state, None, None, &profile.id, None)
            .expect_err("should fail when chromium is missing");
        assert!(err.contains("Chromium 未安装"), "unexpected error: {err}");
    }

    #[test]
    fn close_profile_recovers_stale_running_state_without_engine_session() {
        let state = new_test_state();

        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            let created = service
                .create_profile(CreateProfileRequest {
                    name: "stale-running".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile");
            service
                .mark_profile_running(&created.id, true)
                .expect("mark running");
            created
        };

        {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            assert!(!engine_manager.is_running(&profile.id));
        }

        let closed = do_close_profile(&state, &profile.id).expect("close stale profile");
        assert!(!closed.running);
    }

    #[test]
    fn close_profile_does_not_snapshot_cookies_before_shutdown() {
        let state = new_test_state();
        let (magic_port, server) = spawn_cookie_export_magic_server();

        let profile = {
            let service = state.profile_service.lock().expect("profile service lock");
            let created = service
                .create_profile(CreateProfileRequest {
                    name: "close-no-snapshot".to_string(),
                    group: None,
                    note: None,
                    proxy_id: None,
                    settings: None,
                })
                .expect("create profile");
            service
                .mark_profile_running(&created.id, true)
                .expect("mark running");
            created
        };
        {
            let mut engine_manager = state.engine_manager.lock().expect("engine manager lock");
            engine_manager.restore_session(
                EngineSession {
                    profile_id: profile.id.clone(),
                    session_id: 1,
                    pid: None,
                    started_at: crate::models::now_ts(),
                    debug_port: Some(29222),
                    magic_port: Some(magic_port),
                },
                profile.name.clone(),
            );
            assert!(engine_manager.is_running(&profile.id));
        }

        let cookie_path = {
            let engine_manager = state.engine_manager.lock().expect("engine manager lock");
            resolve_profile_cookie_state_path(&engine_manager, &profile.id).expect("cookie path")
        };

        let closed = do_close_profile(&state, &profile.id).expect("close profile");
        let handled_requests = server.join().expect("join cookie export magic server");

        assert!(!closed.running);
        assert_eq!(
            handled_requests, 0,
            "close must not call magic cookie export before shutdown"
        );
        assert!(
            !cookie_path.exists(),
            "close must not write cookie snapshot before shutdown"
        );
    }

    #[test]
    fn do_open_profile_recovers_from_poisoned_profile_service_lock() {
        let state = new_test_state();
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state.profile_service.lock().expect("profile service lock");
            panic!("poison profile service lock");
        }));

        let err = do_open_profile(&state, None, None, "pf_999999", None)
            .expect_err("missing profile should still fail");

        assert!(
            err.contains("profile not found"),
            "unexpected error after poisoned lock recovery: {err}"
        );
    }
}
