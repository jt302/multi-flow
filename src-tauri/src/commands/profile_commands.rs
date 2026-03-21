use std::fs;

use tauri::{AppHandle, Emitter, State};

use crate::engine_manager::EngineLaunchOptions;
use crate::error::AppError;
use crate::fingerprint_catalog;
use crate::font_catalog;
use crate::logger;
use crate::models::{
    BatchProfileActionItem, BatchProfileActionRequest, BatchProfileActionResponse,
    BatchSetProfileGroupRequest, ClearProfileCacheResponse, CreateProfileRequest, FontListMode,
    GeolocationOverride, ListProfilesQuery, ListProfilesResponse, LocalApiServerStatus,
    OpenProfileOptions, OpenProfileResponse, Profile, ProfileDevicePreset,
    ProfileFingerprintSnapshot, ProfileFingerprintSource, ProfileRuntimeDetails, ProfileSettings,
    Proxy, SaveProfileDevicePresetRequest, SetProfileGroupRequest, UpdateProfileVisualRequest,
    WebRtcMode,
};
use crate::runtime_guard;
use crate::services::device_preset_service::DevicePresetService;
use crate::state::AppState;

const DEFAULT_STARTUP_URL: &str = "https://www.browserscan.net/";
const RESOURCE_PROGRESS_EVENT: &str = "resource_download_progress";

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
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let created = profile_service
        .create_profile(payload)
        .map_err(error_to_string)?;
    drop(profile_service);

    if let Some(proxy_id) = requested_proxy_id {
        let proxy_service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        proxy_service
            .bind_profile_proxy(&created.id, &proxy_id)
            .map_err(error_to_string)?;
    }

    logger::info(
        "profile_cmd",
        format!("create_profile success profile_id={}", created.id),
    );
    Ok(created)
}

#[tauri::command]
pub fn list_profiles(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
    page: Option<u64>,
    page_size: Option<u64>,
    keyword: Option<String>,
    group: Option<String>,
    running: Option<bool>,
) -> Result<ListProfilesResponse, String> {
    runtime_guard::reconcile_runtime_state(&state).map_err(error_to_string)?;

    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;

    let query = ListProfilesQuery {
        include_deleted: include_deleted.unwrap_or(false),
        page: page.unwrap_or(1),
        page_size: page_size.unwrap_or(50),
        keyword,
        group,
        running,
    };

    profile_service
        .list_profiles(query)
        .map_err(error_to_string)
}

#[tauri::command]
pub fn open_profile(
    app: AppHandle,
    state: State<'_, AppState>,
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
    do_open_profile(&state, Some(&app), task_id.as_deref(), &profile_id, options)
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
            "validation failed: profile is running, only background color and toolbar text can be changed at runtime"
                .to_string(),
        );
    }
    let updated = profile_service
        .update_profile(&profile_id, payload.clone())
        .map_err(error_to_string)?;
    drop(profile_service);

    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    if let Some(proxy_id) = payload.proxy_id {
        if proxy_id.trim().is_empty() {
            unbind_profile_proxy_if_exists(&proxy_service, &profile_id)?;
        } else {
            proxy_service
                .bind_profile_proxy(&profile_id, &proxy_id)
                .map_err(error_to_string)?;
        }
    } else {
        unbind_profile_proxy_if_exists(&proxy_service, &profile_id)?;
    }
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
            "update_profile_visual request profile_id={profile_id} bg={:?} toolbar={:?}",
            payload.browser_bg_color, payload.toolbar_text
        ),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let profile = profile_service
        .update_profile_visual(
            &profile_id,
            payload.browser_bg_color.clone(),
            payload.toolbar_text.clone(),
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
                payload.browser_bg_color,
                payload.toolbar_text,
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
) -> Result<ProfileDevicePreset, String> {
    let service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    service
        .update_preset(&preset_id, payload)
        .map_err(error_to_string)
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
pub fn batch_open_profiles(
    app: AppHandle,
    state: State<'_, AppState>,
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
    task_id: Option<&str>,
    profile_id: &str,
    user_options: Option<OpenProfileOptions>,
) -> Result<OpenProfileResponse, String> {
    logger::info(
        "profile_cmd",
        format!("do_open_profile start profile_id={profile_id}"),
    );
    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| "engine session service lock poisoned".to_string())?;
    let proxy_service = state
        .proxy_service
        .lock()
        .map_err(|_| "proxy service lock poisoned".to_string())?;
    let resource_service = state
        .resource_service
        .lock()
        .map_err(|_| "resource service lock poisoned".to_string())?;
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    profile_service
        .ensure_profile_openable(profile_id)
        .map_err(error_to_string)?;
    let mut profile_snapshot = profile_service
        .get_profile(profile_id)
        .map_err(error_to_string)?;
    let fingerprint_seed =
        resolve_fingerprint_seed(profile_id, &mut profile_snapshot, &profile_service)?;

    let preferred_chromium_version = profile_snapshot
        .settings
        .as_ref()
        .and_then(|settings| settings.basic.as_ref())
        .and_then(|basic| basic.browser_version.as_deref())
        .and_then(trim_str_to_option);
    let (resource_id, resolved_browser_version, chromium_executable) = if state.require_real_engine
    {
        resource_service
            .ensure_chromium_version_available(
                preferred_chromium_version.as_deref(),
                |resource_id, stage, downloaded, total| {
                    if let (Some(app), Some(task_id)) = (app, task_id) {
                        emit_resource_progress(
                            app,
                            task_id,
                            resource_id,
                            stage,
                            downloaded,
                            total,
                            match stage {
                                "download" => "环境启动前自动下载浏览器版本",
                                "install" => "环境启动前自动安装浏览器版本",
                                "done" => "浏览器版本已就绪",
                                _ => "处理中",
                            },
                        );
                    }
                },
            )
            .map_err(error_to_string)?
    } else {
        let resolved_browser_version = preferred_chromium_version
            .clone()
            .or_else(|| {
                resource_service
                    .latest_host_compatible_chromium_version()
                    .ok()
                    .flatten()
            })
            .unwrap_or_else(|| fingerprint_catalog::default_browser_version().to_string());
        let chromium_executable = preferred_chromium_version
            .as_deref()
            .and_then(|version| resource_service.resolve_chromium_executable_for_version(version))
            .or_else(|| resource_service.resolve_active_chromium_executable())
            .unwrap_or_default();
        (String::new(), resolved_browser_version, chromium_executable)
    };
    let active_chromium = chromium_executable
        .is_file()
        .then_some(chromium_executable.clone());
    logger::info(
        "profile_cmd",
        format!(
            "resolved chromium executable profile_id={profile_id} preferred_version={preferred_chromium_version:?} resource_id={resource_id} resolved_version={resolved_browser_version} executable={active_chromium:?}"
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

    let bound_proxy = proxy_service
        .get_profile_proxy(profile_id)
        .map_err(error_to_string)?;
    let daemon_proxy_server = match bound_proxy.as_ref() {
        Some(proxy) => {
            let mut local_api_server = state
                .local_api_server
                .lock()
                .map_err(|_| "local api server lock poisoned".to_string())?;
            Some(local_api_server.start_proxy_runtime(profile_id, proxy)?)
        }
        None => None,
    };
    let geoip_database = resource_service.resolve_geoip_database_path();
    let mut merged_options = merge_open_options(profile_snapshot.settings.as_ref(), user_options);
    merged_options.fingerprint_seed = Some(fingerprint_seed);
    let device_preset_service = state
        .device_preset_service
        .lock()
        .map_err(|_| "device preset service lock poisoned".to_string())?;
    let launch_options = resolve_launch_options(
        &device_preset_service,
        profile_id,
        &profile_snapshot.name,
        profile_snapshot.settings.as_ref(),
        merged_options,
        bound_proxy.as_ref(),
        daemon_proxy_server.clone(),
        geoip_database,
        Some(resolved_browser_version.as_str()),
    )?;
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
    let _ = engine_manager.apply_profile_visual_overrides(
        profile_id,
        launch_options.background_color.clone(),
        launch_options.toolbar_text.clone(),
    );

    let profile = match profile_service.mark_profile_running(profile_id, true) {
        Ok(profile) => profile,
        Err(err) => {
            let _ = engine_manager.close_profile(profile_id);
            stop_profile_proxy_runtime_quietly(state, profile_id);
            return Err(error_to_string(err));
        }
    };
    if let Err(err) = engine_session_service.save_session(profile_id, &session) {
        let _ = engine_manager.close_profile(profile_id);
        let _ = profile_service.mark_profile_running(profile_id, false);
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
) -> Result<EngineLaunchOptions, String> {
    let startup_urls =
        normalize_startup_urls(options.startup_urls.clone(), options.startup_url.clone())
            .map_err(|_| format!("validation failed: invalid startupUrl for {profile_id}"))?
            .unwrap_or_else(|| vec![DEFAULT_STARTUP_URL.to_string()]);
    let geolocation = options
        .geolocation
        .clone()
        .or_else(|| bound_proxy.and_then(default_geolocation_from_proxy));
    if let Some(geo) = geolocation.as_ref() {
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
    }
    let proxy_server = if let Some(proxy_server) = daemon_proxy_server.and_then(trim_to_option) {
        Some(proxy_server)
    } else {
        match bound_proxy {
            Some(proxy) => Some(proxy_to_arg(proxy)?),
            None => None,
        }
    };
    let runtime_snapshot = resolve_runtime_fingerprint_snapshot(
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
    let language = runtime_snapshot
        .language
        .clone()
        .or_else(|| bound_proxy.and_then(default_language_from_proxy));
    let timezone_id = runtime_snapshot
        .time_zone
        .clone()
        .or_else(|| bound_proxy.and_then(default_timezone_from_proxy));

    let mut extra_args = Vec::new();
    let web_rtc_mode = options.web_rtc_mode.unwrap_or(WebRtcMode::Real);
    match web_rtc_mode {
        WebRtcMode::Real => {}
        WebRtcMode::Replace => {
            let ip = options
                .webrtc_ip_override
                .as_deref()
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
            extra_args.push(format!("--webrtc-ip-override={ip}"));
        }
        WebRtcMode::Disable => {
            extra_args.push("--disable-webrtc".to_string());
        }
    }
    if let Some(geo) = geolocation {
        extra_args.push(format!(
            "--multi-flow-geolocation={},{}",
            geo.latitude, geo.longitude
        ));
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

    let mut toolbar_text = Some(profile_name.to_string());
    let mut background_color = None;
    if let Some(settings) = profile_settings.and_then(|value| value.basic.as_ref()) {
        if let Some(value) = settings
            .toolbar_text
            .as_deref()
            .and_then(trim_str_to_option)
        {
            toolbar_text = Some(value);
        }
        background_color = settings
            .browser_bg_color
            .as_deref()
            .and_then(trim_str_to_option);
    }

    Ok(EngineLaunchOptions {
        user_agent,
        language,
        timezone_id,
        startup_urls,
        proxy_server,
        web_rtc_policy: None,
        geoip_database_path: geoip_database,
        headless: options.headless.unwrap_or(false),
        disable_images: options.disable_images.unwrap_or(false),
        toolbar_text,
        background_color,
        custom_cpu_cores,
        custom_ram_gb,
        custom_font_list,
        extra_args,
    })
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
            merged.web_rtc_mode = fingerprint.web_rtc_mode.clone();
            merged.webrtc_ip_override = fingerprint.webrtc_ip_override.clone();
        }
        if let Some(advanced) = settings.advanced.as_ref() {
            merged.geolocation = advanced.geolocation.clone();
            merged.headless = advanced.headless;
            merged.disable_images = advanced.disable_images;
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
        if overrides.geolocation.is_some() {
            merged.geolocation = overrides.geolocation;
        }
        if overrides.web_rtc_mode.is_some() {
            merged.web_rtc_mode = overrides.web_rtc_mode;
        }
        if overrides.webrtc_ip_override.is_some() {
            merged.webrtc_ip_override = overrides.webrtc_ip_override;
        }
        if overrides.headless.is_some() {
            merged.headless = overrides.headless;
        }
        if overrides.disable_images.is_some() {
            merged.disable_images = overrides.disable_images;
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
            return Ok(snapshot);
        }
    }

    let source = fingerprint
        .and_then(|settings| settings.fingerprint_source.as_ref())
        .cloned()
        .unwrap_or_else(|| {
            fingerprint_catalog::normalize_source(
                None,
                basic.and_then(|item| item.platform.as_deref()),
                resolved_browser_version
                    .or_else(|| basic.and_then(|item| item.browser_version.as_deref())),
                basic.and_then(|item| item.device_preset_id.as_deref()),
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
    if let Some(time_zone) = snapshot.time_zone.as_deref().and_then(trim_str_to_option) {
        extra_args.push(format!("--custom-time-zone={time_zone}"));
    }
    if let Some(touch_points) = snapshot.custom_touch_points {
        extra_args.push(format!("--custom-touch-points={touch_points}"));
        extra_args.push("--touch-events=enabled".to_string());
    }
    if snapshot.mobile == Some(true) {
        extra_args.push("--use-mobile-user-agent".to_string());
    }
    if let (Some(width), Some(height)) = (snapshot.window_width, snapshot.window_height) {
        extra_args.push(format!("--window-size={width},{height}"));
    }
    if let Some(device_scale_factor) = snapshot.device_scale_factor {
        extra_args.push(format!(
            "--force-device-scale-factor={}",
            format_device_scale_factor(device_scale_factor)
        ));
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

fn emit_resource_progress(
    app: &AppHandle,
    task_id: &str,
    resource_id: &str,
    stage: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    message: &str,
) {
    let percent = total_bytes.and_then(|total| {
        if total == 0 {
            None
        } else {
            Some(((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0))
        }
    });
    let payload = serde_json::json!({
        "taskId": task_id,
        "resourceId": resource_id,
        "stage": stage,
        "downloadedBytes": downloaded_bytes,
        "totalBytes": total_bytes,
        "percent": percent,
        "message": message,
    });
    let _ = app.emit(RESOURCE_PROGRESS_EVENT, payload);
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
            let value = match country.as_str() {
                "CN" => "zh-CN",
                "TW" => "zh-TW",
                "HK" => "zh-HK",
                "JP" => "ja-JP",
                "KR" => "ko-KR",
                "DE" => "de-DE",
                "FR" => "fr-FR",
                "GB" => "en-GB",
                "US" => "en-US",
                _ => "en-US",
            };
            Some(value.to_string())
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
            let value = match country.as_str() {
                "CN" => "Asia/Shanghai",
                "JP" => "Asia/Tokyo",
                "KR" => "Asia/Seoul",
                "DE" => "Europe/Berlin",
                "FR" => "Europe/Paris",
                "GB" => "Europe/London",
                "US" => "America/New_York",
                _ => return None,
            };
            Some(value.to_string())
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
    let mut local_api_server = match state.local_api_server.lock() {
        Ok(value) => value,
        Err(_) => {
            logger::warn(
                "profile_cmd",
                format!(
                    "skip stopping proxy daemon runtime because local api server lock poisoned profile_id={profile_id}"
                ),
            );
            return;
        }
    };
    if let Err(err) = local_api_server.stop_proxy_runtime(profile_id) {
        logger::warn(
            "profile_cmd",
            format!("proxy daemon stop failed profile_id={profile_id} err={err}"),
        );
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::db;
    use crate::engine_manager::EngineManager;
    use crate::local_api_server::LocalApiServer;
    use crate::models::{
        CreateProfileRequest, GeolocationOverride, OpenProfileOptions, Proxy, ProxyLifecycle,
        WebRtcMode,
    };
    use crate::services::chromium_magic_adapter_service::ChromiumMagicAdapterService;
    use crate::services::device_preset_service::DevicePresetService;
    use crate::services::engine_session_service::EngineSessionService;
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
        let profiles_root =
            std::env::temp_dir().join(format!("multi-flow-profile-root-{unique}"));
        std::fs::create_dir_all(&profiles_root).expect("profiles root");
        let mut local_api_server = LocalApiServer::new("127.0.0.1:18180");
        local_api_server.mark_started();

        AppState {
            profile_group_service: Mutex::new(profile_group_service),
            profile_service: Mutex::new(profile_service),
            device_preset_service: Mutex::new(device_preset_service),
            engine_session_service: Mutex::new(engine_session_service),
            proxy_service: Mutex::new(proxy_service),
            resource_service: Mutex::new(resource_service),
            engine_manager: Mutex::new(EngineManager::with_profiles_root(profiles_root)),
            local_api_server: Mutex::new(local_api_server),
            chromium_magic_adapter_service: Mutex::new(ChromiumMagicAdapterService::new()),
            sync_manager_service: Mutex::new(SyncManagerService::new_mock(None, None)),
            require_real_engine: false,
        }
    }

    fn new_test_device_preset_service() -> DevicePresetService {
        let db = db::init_test_database().expect("init test db");
        DevicePresetService::from_db(db)
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

        let details =
            build_profile_runtime_details(&state, &profile.id).expect("runtime details");

        assert!(details.profile_root_dir.ends_with(&profile.id));
        assert!(details.user_data_dir.ends_with(&format!("{}/user-data", profile.id)));
        assert!(details.cache_data_dir.ends_with(&format!("{}/cache-data", profile.id)));
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

        let response =
            clear_profile_cache_inner(&state, &profile.id).expect("clear cache");
        assert_eq!(response.profile_id, profile.id);
        assert!(cache_dir.exists());
        assert!(!cache_dir.join("temp.bin").exists());

        let _ = do_open_profile(&state, None, None, &profile.id, None).expect("open profile");
        let err = clear_profile_cache_inner(&state, &profile.id)
            .expect_err("running profile should reject");
        assert!(err.contains("不能清理 cache"));
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
        )
        .expect("resolve launch options");
        assert_eq!(options.language.as_deref(), Some("en-US"));
        assert_eq!(options.timezone_id.as_deref(), Some("America/Los_Angeles"));
        assert_eq!(
            options.proxy_server.as_deref(),
            Some("http://127.0.0.1:8080")
        );
        assert_eq!(options.web_rtc_policy, None);
        assert_eq!(
            options.startup_urls,
            vec!["https://www.browserscan.net/".to_string()]
        );
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
        )
        .expect_err("invalid geolocation should fail");
        assert!(err.contains("invalid latitude"));
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
        )
        .expect("resolve launch options");

        assert!(options
            .user_agent
            .as_deref()
            .is_some_and(|value| value.contains("Chrome/144.0.7559.97")));
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
        )
        .expect("resolve launch options");

        assert_eq!(
            options.custom_font_list.as_ref(),
            Some(&vec!["Custom UI".to_string(), "Custom Sans".to_string()])
        );
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
            .any(|item| item == "--window-size=412,915"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--force-device-scale-factor=2.625"));
        assert!(options.extra_args.iter().any(|item| {
            item.starts_with(
                "--custom-ua-metadata=platform=Android|platform_version=14.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:144,Chromium:144|form_factors=Mobile",
            )
        }));
        assert_eq!(
            options.user_agent.as_deref(),
            Some(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.97 Mobile Safari/537.36"
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
            .any(|item| item == "--window-size=393,852"));
        assert!(options
            .extra_args
            .iter()
            .any(|item| item == "--force-device-scale-factor=3"));
        assert!(options.extra_args.iter().any(|item| {
            item.starts_with(
                "--custom-ua-metadata=platform=iOS|platform_version=17.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:144,Chromium:144|form_factors=Mobile",
            )
        }));
        assert_eq!(
            options.user_agent.as_deref(),
            Some(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/144.0.7559.97 Mobile/15E148 Safari/604.1"
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
        assert!(err.contains("no chromium build for version 999.0.0.0"));
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
}
