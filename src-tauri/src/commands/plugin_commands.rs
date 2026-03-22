use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

use reqwest::header::CONTENT_TYPE;
use reqwest::blocking::Client;
use reqwest::{Proxy as ReqwestProxy, Url};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use zip::ZipArchive;

use crate::error::AppError;
use crate::logger;
use crate::models::{
    BatchProfileActionItem, BatchProfileActionResponse, CreateProfileRequest,
    DownloadPluginByExtensionIdRequest, InstallPluginToProfilesRequest, PluginPackage,
    PluginDownloadPreference, ProfileAdvancedSettings, ProfilePluginSelection,
    UpdateProfilePluginsRequest,
};
use crate::state::AppState;

const CHROME_WEB_STORE_UPDATE_URL: &str = "https://clients2.google.com/service/update2/crx";
const CHROME_WEB_STORE_PRODUCT: &str = "chromecrx";
const CHROME_WEB_STORE_PRODVERSION: &str = "999.0.0.0";
const CHROME_WEB_STORE_ACCEPT_FORMAT: &str = "crx3";
const CHROME_WEB_STORE_TITLE_SUFFIX: &str = " - Chrome Web Store";
const SOURCE_TYPE_CRX: &str = "crx";
const UPDATE_STATUS_UNKNOWN: &str = "unknown";
const UPDATE_STATUS_UP_TO_DATE: &str = "up_to_date";
const UPDATE_STATUS_AVAILABLE: &str = "update_available";
const UPDATE_STATUS_ERROR: &str = "error";
const PLUGIN_CONNECT_TIMEOUT_SECS: u64 = 8;
const PLUGIN_DOWNLOAD_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone)]
struct PluginProxyConfig {
    proxy_id: String,
    protocol: String,
    host: String,
    port: i32,
    username: Option<String>,
    password: Option<String>,
}

#[derive(Debug)]
struct DownloadedPluginPackage {
    package: PluginPackage,
}

#[derive(Debug)]
struct ParsedPluginBundle {
    manifest: Value,
    name: String,
    description: Option<String>,
    version: String,
    icon_relative_path: Option<String>,
}

#[derive(Debug, Default)]
struct PluginUpdateCheck {
    version: Option<String>,
    codebase: Option<String>,
}

#[derive(Debug, Default)]
struct StoreListingMetadata {
    title: Option<String>,
    description: Option<String>,
    icon_url: Option<String>,
}

#[tauri::command]
pub fn list_plugin_packages(state: State<'_, AppState>) -> Result<Vec<PluginPackage>, String> {
    let service = state
        .plugin_package_service
        .lock()
        .map_err(|_| "plugin package service lock poisoned".to_string())?;
    service.list_packages().map_err(error_to_string)
}

#[tauri::command]
pub async fn read_plugin_download_preference(
    app: AppHandle,
) -> Result<PluginDownloadPreference, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        read_plugin_download_preference_inner(&state)
    })
    .await
    .map_err(|err| format!("读取插件下载代理偏好任务执行失败: {err}"))?
}

fn read_plugin_download_preference_inner(
    state: &AppState,
) -> Result<PluginDownloadPreference, String> {
    let saved_proxy_id = {
        let service = state
            .app_preference_service
            .lock()
            .map_err(|_| "app preference service lock poisoned".to_string())?;
        service
            .read_plugin_download_proxy_id()
            .map_err(error_to_string)?
    };
    let proxy_id = validate_saved_plugin_download_proxy_id(state, saved_proxy_id)?;
    Ok(PluginDownloadPreference { proxy_id })
}

#[tauri::command]
pub async fn update_plugin_download_preference(
    app: AppHandle,
    proxy_id: Option<String>,
) -> Result<PluginDownloadPreference, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        update_plugin_download_preference_inner(&state, proxy_id)
    })
    .await
    .map_err(|err| format!("更新插件下载代理偏好任务执行失败: {err}"))?
}

fn update_plugin_download_preference_inner(
    state: &AppState,
    proxy_id: Option<String>,
) -> Result<PluginDownloadPreference, String> {
    let normalized_proxy_id = normalize_optional_proxy_id(proxy_id);
    if let Some(proxy_id) = normalized_proxy_id.as_deref() {
        let service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        service.get_proxy(proxy_id).map_err(error_to_string)?;
    }
    let service = state
        .app_preference_service
        .lock()
        .map_err(|_| "app preference service lock poisoned".to_string())?;
    service
        .save_plugin_download_proxy_id(normalized_proxy_id.clone())
        .map_err(error_to_string)?;
    Ok(PluginDownloadPreference {
        proxy_id: normalized_proxy_id,
    })
}

#[tauri::command]
pub async fn download_plugin_by_extension_id(
    app: AppHandle,
    payload: DownloadPluginByExtensionIdRequest,
) -> Result<PluginPackage, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        download_plugin_by_extension_id_inner(&app_handle, &state, payload)
    })
    .await
    .map_err(|err| format!("插件下载任务执行失败: {err}"))?
}

fn download_plugin_by_extension_id_inner(
    app: &AppHandle,
    state: &AppState,
    payload: DownloadPluginByExtensionIdRequest,
) -> Result<PluginPackage, String> {
    let extension_id = normalize_extension_id(&payload.extension_id)?;
    let proxy = resolve_plugin_proxy(state, payload.proxy_id)?;
    logger::info(
        "plugin_cmd",
        format!(
            "download_plugin_by_extension_id start extension_id={extension_id} proxy_id={}",
            proxy.as_ref().map(|item| item.proxy_id.as_str()).unwrap_or("direct")
        ),
    );
    let downloaded =
        download_and_store_plugin_package(app, state, &extension_id, None, proxy.as_ref())?;
    rewrite_profiles_referencing_package(&state, &downloaded.package.package_id)?;
    logger::info(
        "plugin_cmd",
        format!(
            "download_plugin_by_extension_id success extension_id={} package_id={}",
            extension_id, downloaded.package.package_id
        ),
    );
    Ok(downloaded.package)
}

#[tauri::command]
pub async fn check_plugin_update(
    app: AppHandle,
    package_id: String,
    proxy_id: Option<String>,
) -> Result<PluginPackage, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        check_plugin_update_inner(&app_handle, &state, package_id, proxy_id)
    })
    .await
    .map_err(|err| format!("插件更新检查任务执行失败: {err}"))?
}

fn check_plugin_update_inner(
    app: &AppHandle,
    state: &AppState,
    package_id: String,
    proxy_id: Option<String>,
) -> Result<PluginPackage, String> {
    let proxy = resolve_plugin_proxy(state, proxy_id)?;
    let package = {
        let service = state
            .plugin_package_service
            .lock()
            .map_err(|_| "plugin package service lock poisoned".to_string())?;
        service.get_package(&package_id).map_err(error_to_string)?
    };
    let result = fetch_plugin_update_check(&package.extension_id, proxy.as_ref())?;
    let refreshed_store_metadata =
        refresh_plugin_store_listing_metadata(app, &package, proxy.as_ref()).ok();
    let update_status = match result.version.as_deref() {
        Some(version) if version == package.version => UPDATE_STATUS_UP_TO_DATE.to_string(),
        Some(_) => UPDATE_STATUS_AVAILABLE.to_string(),
        None => UPDATE_STATUS_ERROR.to_string(),
    };
    let service = state
        .plugin_package_service
        .lock()
        .map_err(|_| "plugin package service lock poisoned".to_string())?;
    service
        .save_package(crate::models::SavePluginPackageInput {
            package_id: package.package_id,
            extension_id: package.extension_id,
            name: refreshed_store_metadata
                .as_ref()
                .and_then(|item| item.title.clone())
                .unwrap_or(package.name),
            version: package.version,
            description: refreshed_store_metadata
                .as_ref()
                .and_then(|item| item.description.clone())
                .or(package.description),
            icon_path: refreshed_store_metadata
                .as_ref()
                .and_then(|item| item.icon_path.clone())
                .or(package.icon_path),
            crx_path: package.crx_path,
            source_type: package.source_type,
            store_url: package.store_url,
            update_url: package.update_url,
            latest_version: result.version,
            update_status: Some(update_status),
        })
        .map_err(error_to_string)
}

#[tauri::command]
pub async fn update_plugin_package(
    app: AppHandle,
    package_id: String,
    proxy_id: Option<String>,
) -> Result<PluginPackage, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        update_plugin_package_inner(&app_handle, &state, package_id, proxy_id)
    })
    .await
    .map_err(|err| format!("插件更新任务执行失败: {err}"))?
}

fn update_plugin_package_inner(
    app: &AppHandle,
    state: &AppState,
    package_id: String,
    proxy_id: Option<String>,
) -> Result<PluginPackage, String> {
    let proxy = resolve_plugin_proxy(state, proxy_id)?;
    let package = {
        let service = state
            .plugin_package_service
            .lock()
            .map_err(|_| "plugin package service lock poisoned".to_string())?;
        service.get_package(&package_id).map_err(error_to_string)?
    };
    let update = fetch_plugin_update_check(&package.extension_id, proxy.as_ref())?;
    let codebase = update
        .codebase
        .as_deref()
        .ok_or_else(|| "插件更新检查未返回可下载地址".to_string())?;
    let downloaded = download_and_store_plugin_package(
        app,
        state,
        &package.extension_id,
        Some(codebase),
        proxy.as_ref(),
    )?;
    rewrite_profiles_referencing_package(&state, &downloaded.package.package_id)?;
    Ok(downloaded.package)
}

#[tauri::command]
pub async fn uninstall_plugin_package(
    app: AppHandle,
    package_id: String,
) -> Result<PluginPackage, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        uninstall_plugin_package_inner(&state, package_id)
    })
    .await
    .map_err(|err| format!("插件卸载任务执行失败: {err}"))?
}

fn uninstall_plugin_package_inner(
    state: &AppState,
    package_id: String,
) -> Result<PluginPackage, String> {
    let removed = {
        let service = state
            .plugin_package_service
            .lock()
            .map_err(|_| "plugin package service lock poisoned".to_string())?;
        service.delete_package(&package_id).map_err(error_to_string)?
    };
    remove_package_from_all_profiles(&state, &removed.package_id)?;
    let package_dir = PathBuf::from(&removed.crx_path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "解析插件目录失败".to_string())?;
    if package_dir.exists() {
        fs::remove_dir_all(&package_dir)
            .map_err(|err| format!("删除插件目录失败: {err}"))?;
    }
    Ok(removed)
}

#[tauri::command]
pub async fn install_plugin_to_profiles(
    app: AppHandle,
    payload: InstallPluginToProfilesRequest,
) -> Result<BatchProfileActionResponse, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        install_plugin_to_profiles_inner(&state, payload)
    })
    .await
    .map_err(|err| format!("插件安装任务执行失败: {err}"))?
}

fn install_plugin_to_profiles_inner(
    state: &AppState,
    payload: InstallPluginToProfilesRequest,
) -> Result<BatchProfileActionResponse, String> {
    let package_id = payload.package_id.trim();
    if package_id.is_empty() {
        return Err("packageId is required".to_string());
    }
    let mut items = Vec::with_capacity(payload.profile_ids.len());
    let mut success_count = 0usize;
    for profile_id in payload.profile_ids {
        match upsert_plugin_selection_for_profile(
            &state,
            &profile_id,
            ProfilePluginSelection {
                package_id: package_id.to_string(),
                enabled: true,
            },
        ) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => items.push(BatchProfileActionItem {
                profile_id,
                ok: false,
                message: err,
            }),
        }
    }
    Ok(BatchProfileActionResponse {
        total: items.len(),
        success_count,
        failed_count: items.len().saturating_sub(success_count),
        items,
    })
}

#[tauri::command]
pub async fn read_profile_plugins(
    app: AppHandle,
    profile_id: String,
) -> Result<Vec<ProfilePluginSelection>, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        read_profile_plugins_inner(&state, profile_id)
    })
    .await
    .map_err(|err| format!("读取环境插件任务执行失败: {err}"))?
}

fn read_profile_plugins_inner(
    state: &AppState,
    profile_id: String,
) -> Result<Vec<ProfilePluginSelection>, String> {
    let profile = {
        let service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        service.get_profile(&profile_id).map_err(error_to_string)?
    };
    crate::commands::profile_commands::read_profile_plugin_selections_from_storage(
        &state,
        &profile_id,
        profile.settings.as_ref(),
    )
}

#[tauri::command]
pub async fn update_profile_plugins(
    app: AppHandle,
    profile_id: String,
    payload: UpdateProfilePluginsRequest,
) -> Result<crate::models::Profile, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        update_profile_plugins_inner(&state, profile_id, payload)
    })
    .await
    .map_err(|err| format!("更新环境插件任务执行失败: {err}"))?
}

fn update_profile_plugins_inner(
    state: &AppState,
    profile_id: String,
    payload: UpdateProfilePluginsRequest,
) -> Result<crate::models::Profile, String> {
    validate_plugin_selections_exist(&state, &payload.selections)?;
    let profile = {
        let profile_service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        let existing = profile_service
            .get_profile(&profile_id)
            .map_err(error_to_string)?;
        let mut settings = existing.settings.unwrap_or_default();
        let advanced = settings.advanced.get_or_insert_with(ProfileAdvancedSettings::default);
        advanced.plugin_selections = Some(dedup_plugin_selections(payload.selections));
        profile_service
            .update_profile(
                &profile_id,
                CreateProfileRequest {
                    name: existing.name.clone(),
                    group: trim_to_option_string(existing.group.clone()),
                    note: trim_to_option_string(existing.note.clone()),
                    proxy_id: None,
                    settings: Some(settings),
                },
            )
            .map_err(error_to_string)?
    };
    crate::commands::profile_commands::sync_profile_extension_state_from_settings_quietly(
        &state,
        &profile_id,
        profile.settings.as_ref(),
    );
    Ok(profile)
}

fn download_and_store_plugin_package(
    app: &AppHandle,
    state: &AppState,
    extension_id: &str,
    codebase_override: Option<&str>,
    proxy: Option<&PluginProxyConfig>,
) -> Result<DownloadedPluginPackage, String> {
    let existing_package = {
        let service = state
            .plugin_package_service
            .lock()
            .map_err(|_| "plugin package service lock poisoned".to_string())?;
        service
            .get_package_by_extension_id(extension_id)
            .map_err(error_to_string)?
    };
    let package_id = existing_package
        .as_ref()
        .map(|item| item.package_id.clone())
        .unwrap_or_else(|| format!("pkg_{extension_id}"));
    let package_dir = resolve_plugin_package_dir(app, &package_id)?;
    fs::create_dir_all(&package_dir)
        .map_err(|err| format!("create plugin package directory failed: {err}"))?;

    let codebase = match codebase_override {
        Some(value) => value.to_string(),
        None => fetch_plugin_download_url(extension_id, proxy)?,
    };
    let bytes = download_binary(&codebase, proxy)?;
    let parsed = parse_downloaded_plugin(extension_id, &bytes)?;

    let crx_path = package_dir.join(format!("{extension_id}.crx"));
    fs::write(&crx_path, &bytes).map_err(|err| format!("write plugin crx failed: {err}"))?;

    let manifest_pretty = serde_json::to_string_pretty(&parsed.manifest)
        .map_err(|err| format!("serialize plugin manifest failed: {err}"))?;
    fs::write(package_dir.join("manifest.json"), format!("{manifest_pretty}\n"))
        .map_err(|err| format!("write plugin manifest failed: {err}"))?;

    let manifest_icon_path = if let Some(relative_icon_path) = parsed.icon_relative_path.as_deref() {
        let zip_bytes = extract_zip_payload(&bytes)?;
        let mut archive =
            ZipArchive::new(Cursor::new(zip_bytes)).map_err(|err| format!("open crx zip failed: {err}"))?;
        let mut icon_file = archive
            .by_name(relative_icon_path)
            .map_err(|err| format!("read plugin icon failed: {err}"))?;
        let icon_target = package_dir.join(
            Path::new(relative_icon_path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        );
        let mut icon_bytes = Vec::new();
        icon_file
            .read_to_end(&mut icon_bytes)
            .map_err(|err| format!("read plugin icon bytes failed: {err}"))?;
        fs::write(&icon_target, icon_bytes)
            .map_err(|err| format!("write plugin icon failed: {err}"))?;
        Some(icon_target.to_string_lossy().to_string())
    } else {
        None
    };
    let store_metadata = fetch_store_listing_metadata(extension_id, proxy).ok();
    let store_icon_path = store_metadata
        .as_ref()
        .and_then(|item| item.icon_url.as_deref())
        .and_then(|icon_url| download_store_icon(&package_dir, icon_url, proxy).ok());

    let update = fetch_plugin_update_check(extension_id, proxy).unwrap_or_default();
    let saved = {
        let service = state
            .plugin_package_service
            .lock()
            .map_err(|_| "plugin package service lock poisoned".to_string())?;
        service
            .save_package(crate::models::SavePluginPackageInput {
                package_id: package_id.clone(),
                extension_id: extension_id.to_string(),
                name: store_metadata
                    .as_ref()
                    .and_then(|item| item.title.clone())
                    .unwrap_or(parsed.name),
                version: parsed.version.clone(),
                description: store_metadata
                    .as_ref()
                    .and_then(|item| item.description.clone())
                    .or(parsed.description),
                icon_path: store_icon_path.or(manifest_icon_path),
                crx_path: crx_path.to_string_lossy().to_string(),
                source_type: SOURCE_TYPE_CRX.to_string(),
                store_url: Some(resolve_plugin_store_url(extension_id)),
                update_url: Some(resolve_plugin_update_manifest_url(extension_id, "updatecheck")?),
                latest_version: Some(
                    update
                        .version
                        .clone()
                        .unwrap_or_else(|| parsed.version.clone()),
                ),
                update_status: Some(match update.version.as_deref() {
                    Some(version) if version == parsed.version => UPDATE_STATUS_UP_TO_DATE.to_string(),
                    Some(_) => UPDATE_STATUS_AVAILABLE.to_string(),
                    None => UPDATE_STATUS_UNKNOWN.to_string(),
                }),
            })
            .map_err(error_to_string)?
    };

    logger::info(
        "plugin_cmd",
        format!(
            "plugin stored extension_id={} package_id={} version={}",
            extension_id, saved.package_id, saved.version
        ),
    );

    Ok(DownloadedPluginPackage { package: saved })
}

fn fetch_plugin_download_url(
    extension_id: &str,
    proxy: Option<&PluginProxyConfig>,
) -> Result<String, String> {
    let update = fetch_plugin_update_check(extension_id, proxy)?;
    update
        .codebase
        .ok_or_else(|| "插件下载地址解析失败".to_string())
}

fn fetch_plugin_update_check(
    extension_id: &str,
    proxy: Option<&PluginProxyConfig>,
) -> Result<PluginUpdateCheck, String> {
    let url = resolve_plugin_update_manifest_url(extension_id, "updatecheck")?;
    logger::info(
        "plugin_cmd",
        format!(
            "fetch_plugin_update_check extension_id={extension_id} proxy_id={} url={url}",
            proxy.as_ref().map(|item| item.proxy_id.as_str()).unwrap_or("direct")
        ),
    );
    let body = http_client(proxy)?
        .get(&url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| map_plugin_http_error("获取插件更新清单", err))?
        .text()
        .map_err(|err| format!("读取插件更新清单响应失败: {err}"))?;
    Ok(parse_update_manifest(&body))
}

fn resolve_plugin_update_manifest_url(extension_id: &str, response: &str) -> Result<String, String> {
    let mut url = Url::parse(CHROME_WEB_STORE_UPDATE_URL)
        .map_err(|err| format!("parse chrome web store update url failed: {err}"))?;
    url.query_pairs_mut()
        .append_pair("response", response)
        .append_pair("prod", CHROME_WEB_STORE_PRODUCT)
        .append_pair("prodversion", CHROME_WEB_STORE_PRODVERSION)
        .append_pair("acceptformat", CHROME_WEB_STORE_ACCEPT_FORMAT)
        .append_pair(
            "x",
            format!("id={extension_id}&installsource=ondemand&uc").as_str(),
        );
    Ok(url.to_string())
}

fn resolve_plugin_store_url(extension_id: &str) -> String {
    format!("https://chromewebstore.google.com/detail/{extension_id}")
}

fn fetch_store_listing_metadata(
    extension_id: &str,
    proxy: Option<&PluginProxyConfig>,
) -> Result<StoreListingMetadata, String> {
    let store_url = resolve_plugin_store_url(extension_id);
    logger::info(
        "plugin_cmd",
        format!(
            "fetch_store_listing_metadata extension_id={extension_id} proxy_id={} url={store_url}",
            proxy.as_ref().map(|item| item.proxy_id.as_str()).unwrap_or("direct")
        ),
    );
    let html = http_client(proxy)?
        .get(&store_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| map_plugin_http_error("获取插件商店详情", err))?
        .text()
        .map_err(|err| format!("读取插件商店详情响应失败: {err}"))?;
    Ok(parse_store_listing_metadata(&html))
}

fn refresh_plugin_store_listing_metadata(
    app: &AppHandle,
    package: &PluginPackage,
    proxy: Option<&PluginProxyConfig>,
) -> Result<ResolvedStoreListingMetadata, String> {
    let metadata = fetch_store_listing_metadata(&package.extension_id, proxy)?;
    let package_dir = resolve_plugin_package_dir(app, &package.package_id)?;
    fs::create_dir_all(&package_dir)
        .map_err(|err| format!("create plugin package directory failed: {err}"))?;
    let icon_path = metadata
        .icon_url
        .as_deref()
        .and_then(|icon_url| download_store_icon(&package_dir, icon_url, proxy).ok())
        .or(package.icon_path.clone());
    Ok(ResolvedStoreListingMetadata {
        title: metadata.title,
        description: metadata.description,
        icon_path,
    })
}

#[derive(Debug, Default)]
struct ResolvedStoreListingMetadata {
    title: Option<String>,
    description: Option<String>,
    icon_path: Option<String>,
}

fn http_client(proxy: Option<&PluginProxyConfig>) -> Result<Client, String> {
    let mut builder = Client::builder();
    builder = builder
        .connect_timeout(Duration::from_secs(PLUGIN_CONNECT_TIMEOUT_SECS))
        .timeout(Duration::from_secs(PLUGIN_DOWNLOAD_TIMEOUT_SECS))
        .user_agent("multi-flow-plugin/0.1");
    if let Some(proxy_config) = proxy {
        builder = builder
            .no_proxy()
            .proxy(build_plugin_reqwest_proxy(proxy_config)?);
    }
    builder
        .build()
        .map_err(|err| format!("build http client failed: {err}"))
}

fn download_binary(url: &str, proxy: Option<&PluginProxyConfig>) -> Result<Vec<u8>, String> {
    logger::info(
        "plugin_cmd",
        format!(
            "download_plugin_binary proxy_id={} url={url}",
            proxy.as_ref().map(|item| item.proxy_id.as_str()).unwrap_or("direct")
        ),
    );
    let mut response = http_client(proxy)?
        .get(url)
        .send()
        .and_then(|result| result.error_for_status())
        .map_err(|err| map_plugin_http_error("下载插件文件", err))?;
    let mut bytes = Vec::new();
    response
        .copy_to(&mut bytes)
        .map_err(|err| format!("read plugin download response failed: {err}"))?;
    Ok(bytes)
}

fn download_store_icon(
    package_dir: &Path,
    icon_url: &str,
    proxy: Option<&PluginProxyConfig>,
) -> Result<String, String> {
    let mut response = http_client(proxy)?
        .get(icon_url)
        .send()
        .and_then(|result| result.error_for_status())
        .map_err(|err| map_plugin_http_error("下载插件商店图标", err))?;
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let mut bytes = Vec::new();
    response
        .copy_to(&mut bytes)
        .map_err(|err| format!("read plugin store icon response failed: {err}"))?;
    let extension = file_extension_from_icon_url_or_content_type(icon_url, content_type.as_deref())
        .unwrap_or("png");
    let icon_target = package_dir.join(format!("store-icon.{extension}"));
    fs::write(&icon_target, bytes).map_err(|err| format!("write plugin store icon failed: {err}"))?;
    Ok(icon_target.to_string_lossy().to_string())
}

fn map_plugin_http_error(action: &str, err: reqwest::Error) -> String {
    if let Some(status) = err.status() {
        return format!("{action}失败，下载源返回 HTTP {}", status.as_u16());
    }
    if err.is_timeout() {
        return format!(
            "{action}超时，当前无法连接 Chrome Web Store，请检查网络或代理后重试"
        );
    }
    if err.is_connect() {
        return format!(
            "{action}失败，当前无法连接 Chrome Web Store，请检查网络或代理后重试"
        );
    }
    format!("{action}失败: {err}")
}

fn parse_store_listing_metadata(html: &str) -> StoreListingMetadata {
    let title = extract_html_meta_content(html, "property", "og:title")
        .or_else(|| extract_html_title(html))
        .map(|value| normalize_store_title(&decode_html_basic_entities(&value)))
        .filter(|value| !value.is_empty());
    let description = extract_html_meta_content(html, "property", "og:description")
        .or_else(|| extract_html_meta_content(html, "name", "description"))
        .map(|value| decode_html_basic_entities(&value))
        .filter(|value| !value.is_empty());
    let icon_url = extract_html_meta_content(html, "property", "og:image")
        .map(|value| decode_html_basic_entities(&value))
        .filter(|value| !value.is_empty());
    StoreListingMetadata {
        title,
        description,
        icon_url,
    }
}

fn extract_html_title(html: &str) -> Option<String> {
    let start = html.find("<title>")?;
    let content_start = start + "<title>".len();
    let end = html[content_start..].find("</title>")?;
    Some(html[content_start..content_start + end].to_string())
}

fn extract_html_meta_content(html: &str, attr: &str, key: &str) -> Option<String> {
    let marker = format!(r#"{attr}="{key}""#);
    let marker_index = html.find(&marker)?;
    let meta_start = html[..marker_index].rfind("<meta")?;
    let meta_end_relative = html[marker_index..].find('>')?;
    let meta_tag = &html[meta_start..marker_index + meta_end_relative];
    extract_html_attribute(meta_tag, "content")
}

fn extract_html_attribute(tag: &str, attr: &str) -> Option<String> {
    let double_quote_pattern = format!(r#"{attr}=""#);
    if let Some(start) = tag.find(&double_quote_pattern) {
        let value_start = start + double_quote_pattern.len();
        let end = tag[value_start..].find('"')?;
        return Some(tag[value_start..value_start + end].to_string());
    }
    let single_quote_pattern = format!("{attr}='");
    if let Some(start) = tag.find(&single_quote_pattern) {
        let value_start = start + single_quote_pattern.len();
        let end = tag[value_start..].find('\'')?;
        return Some(tag[value_start..value_start + end].to_string());
    }
    None
}

fn normalize_store_title(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(CHROME_WEB_STORE_TITLE_SUFFIX)
        .trim()
        .to_string()
}

fn decode_html_basic_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn file_extension_from_icon_url_or_content_type(
    icon_url: &str,
    content_type: Option<&str>,
) -> Option<&'static str> {
    if let Some(content_type) = content_type {
        let normalized = content_type.trim().to_ascii_lowercase();
        if normalized.contains("image/png") {
            return Some("png");
        }
        if normalized.contains("image/jpeg") {
            return Some("jpg");
        }
        if normalized.contains("image/webp") {
            return Some("webp");
        }
        if normalized.contains("image/svg") {
            return Some("svg");
        }
        if normalized.contains("image/x-icon") || normalized.contains("image/vnd.microsoft.icon") {
            return Some("ico");
        }
    }
    let lower = icon_url.to_ascii_lowercase();
    if lower.contains(".png") {
        return Some("png");
    }
    if lower.contains(".jpg") || lower.contains(".jpeg") {
        return Some("jpg");
    }
    if lower.contains(".webp") {
        return Some("webp");
    }
    if lower.contains(".svg") {
        return Some("svg");
    }
    if lower.contains(".ico") {
        return Some("ico");
    }
    None
}

fn resolve_plugin_proxy(
    state: &AppState,
    proxy_id: Option<String>,
) -> Result<Option<PluginProxyConfig>, String> {
    let Some(proxy_id) = normalize_optional_proxy_id(proxy_id) else {
        return Ok(None);
    };
    let proxy = {
        let service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        service.get_proxy(&proxy_id).map_err(error_to_string)?
    };
    if proxy.protocol == "ssh" {
        return Err("插件下载暂不支持 SSH 代理，请改用 HTTP/HTTPS/SOCKS5 代理".to_string());
    }
    Ok(Some(PluginProxyConfig {
        proxy_id: proxy.id,
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
    }))
}

fn validate_saved_plugin_download_proxy_id(
    state: &AppState,
    proxy_id: Option<String>,
) -> Result<Option<String>, String> {
    let Some(proxy_id) = normalize_optional_proxy_id(proxy_id) else {
        return Ok(None);
    };
    let lookup_result = {
        let service = state
            .proxy_service
            .lock()
            .map_err(|_| "proxy service lock poisoned".to_string())?;
        service.get_proxy(&proxy_id)
    };
    if lookup_result.is_ok() {
        return Ok(Some(proxy_id));
    }
    let service = state
        .app_preference_service
        .lock()
        .map_err(|_| "app preference service lock poisoned".to_string())?;
    service
        .save_plugin_download_proxy_id(None)
        .map_err(error_to_string)?;
    Ok(None)
}

fn build_plugin_reqwest_proxy(proxy: &PluginProxyConfig) -> Result<ReqwestProxy, String> {
    let proxy_url = format!("{}://{}:{}", proxy.protocol, proxy.host, proxy.port);
    let mut built =
        ReqwestProxy::all(&proxy_url).map_err(|err| format!("构建插件下载代理失败: {err}"))?;
    if let Some(username) = proxy.username.as_deref().and_then(trim_to_option_ref) {
        built = built.basic_auth(&username, proxy.password.as_deref().unwrap_or(""));
    }
    Ok(built)
}

fn normalize_optional_proxy_id(value: Option<String>) -> Option<String> {
    match value {
        Some(value) => trim_to_option_string(Some(value)),
        None => None,
    }
}

fn trim_to_option_ref(input: impl AsRef<str>) -> Option<String> {
    let trimmed = input.as_ref().trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn resolve_plugin_package_dir(app: &AppHandle, package_id: &str) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(data_dir.join("plugins").join("packages").join(package_id))
}

fn parse_downloaded_plugin(extension_id: &str, crx_bytes: &[u8]) -> Result<ParsedPluginBundle, String> {
    let zip_bytes = extract_zip_payload(crx_bytes)?;
    let mut archive =
        ZipArchive::new(Cursor::new(zip_bytes)).map_err(|err| format!("open crx zip failed: {err}"))?;
    let manifest: Value = {
        let mut file = archive
            .by_name("manifest.json")
            .map_err(|err| format!("read plugin manifest failed: {err}"))?;
        serde_json::from_reader(&mut file)
            .map_err(|err| format!("parse plugin manifest failed: {err}"))?
    };
    let default_locale = manifest
        .get("default_locale")
        .and_then(Value::as_str)
        .map(|value| value.to_string());
    let name = resolve_manifest_string(&manifest, "name", default_locale.as_deref(), &mut archive)
        .unwrap_or_else(|| extension_id.to_string());
    let description =
        resolve_manifest_string(&manifest, "description", default_locale.as_deref(), &mut archive);
    let version = manifest
        .get("version")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "插件 manifest 缺少 version".to_string())?;
    let icon_relative_path = select_icon_path(&manifest);
    Ok(ParsedPluginBundle {
        manifest,
        name,
        description,
        version,
        icon_relative_path,
    })
}

fn extract_zip_payload(crx_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if crx_bytes.starts_with(b"PK\x03\x04") {
        return Ok(crx_bytes.to_vec());
    }
    if crx_bytes.len() < 12 || &crx_bytes[0..4] != b"Cr24" {
        return Err("下载的插件不是合法的 CRX 文件".to_string());
    }
    let version = u32::from_le_bytes(
        crx_bytes[4..8]
            .try_into()
            .map_err(|_| "读取 CRX 版本失败".to_string())?,
    );
    let offset = match version {
        2 => {
            if crx_bytes.len() < 16 {
                return Err("CRX v2 文件头过短".to_string());
            }
            let pubkey_len = u32::from_le_bytes(
                crx_bytes[8..12]
                    .try_into()
                    .map_err(|_| "读取 CRX v2 公钥长度失败".to_string())?,
            ) as usize;
            let sig_len = u32::from_le_bytes(
                crx_bytes[12..16]
                    .try_into()
                    .map_err(|_| "读取 CRX v2 签名长度失败".to_string())?,
            ) as usize;
            16usize.saturating_add(pubkey_len).saturating_add(sig_len)
        }
        3 => {
            let header_size = u32::from_le_bytes(
                crx_bytes[8..12]
                    .try_into()
                    .map_err(|_| "读取 CRX v3 header 大小失败".to_string())?,
            ) as usize;
            12usize.saturating_add(header_size)
        }
        other => {
            return Err(format!("暂不支持的 CRX 版本: {other}"));
        }
    };
    if offset >= crx_bytes.len() {
        return Err("CRX zip 偏移超出文件范围".to_string());
    }
    Ok(crx_bytes[offset..].to_vec())
}

fn resolve_manifest_string(
    manifest: &Value,
    key: &str,
    default_locale: Option<&str>,
    archive: &mut ZipArchive<Cursor<Vec<u8>>>,
) -> Option<String> {
    let raw = manifest.get(key)?.as_str()?.trim();
    if raw.is_empty() {
        return None;
    }
    if !raw.starts_with("__MSG_") || !raw.ends_with("__") {
        return Some(raw.to_string());
    }
    let locale = default_locale.unwrap_or("en");
    let message_key = raw
        .trim_start_matches("__MSG_")
        .trim_end_matches("__")
        .to_lowercase();
    let path = format!("_locales/{locale}/messages.json");
    let mut file = archive.by_name(&path).ok()?;
    let messages: Value = serde_json::from_reader(&mut file).ok()?;
    messages
        .get(&message_key)
        .and_then(|value| value.get("message"))
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn select_icon_path(manifest: &Value) -> Option<String> {
    let icons = manifest.get("icons")?.as_object()?;
    icons
        .iter()
        .filter_map(|(size, path)| {
            Some((size.parse::<u32>().ok()?, path.as_str()?.trim().to_string()))
        })
        .filter(|(_, path)| !path.is_empty())
        .max_by_key(|(size, _)| *size)
        .map(|(_, path)| path)
}

fn parse_update_manifest(xml: &str) -> PluginUpdateCheck {
    let scope = xml
        .find("<updatecheck")
        .and_then(|start| xml[start..].find('>').map(|end| &xml[start..start + end]))
        .unwrap_or(xml);
    PluginUpdateCheck {
        version: extract_xml_attribute(scope, "version"),
        codebase: extract_xml_attribute(scope, "codebase"),
    }
}

fn extract_xml_attribute(xml: &str, attribute: &str) -> Option<String> {
    let pattern = format!("{attribute}=\"");
    let start = xml.find(&pattern)?;
    let value_start = start + pattern.len();
    let rest = &xml[value_start..];
    let end = rest.find('"')?;
    let value = rest[..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn validate_plugin_selections_exist(
    state: &AppState,
    selections: &[ProfilePluginSelection],
) -> Result<(), String> {
    let service = state
        .plugin_package_service
        .lock()
        .map_err(|_| "plugin package service lock poisoned".to_string())?;
    for selection in selections {
        let package = service
            .get_package(&selection.package_id)
            .map_err(error_to_string)?;
        if !Path::new(&package.crx_path).is_file() {
            return Err(format!(
                "插件包文件不存在，请重新下载后再安装: {}",
                package.name
            ));
        }
    }
    Ok(())
}

fn dedup_plugin_selections(mut selections: Vec<ProfilePluginSelection>) -> Vec<ProfilePluginSelection> {
    selections.retain(|item| !item.package_id.trim().is_empty());
    let mut deduped = Vec::with_capacity(selections.len());
    for selection in selections {
        if let Some(existing) = deduped
            .iter_mut()
            .find(|item: &&mut ProfilePluginSelection| item.package_id == selection.package_id)
        {
            existing.enabled = selection.enabled;
            continue;
        }
        deduped.push(selection);
    }
    deduped
}

fn upsert_plugin_selection_for_profile(
    state: &AppState,
    profile_id: &str,
    selection: ProfilePluginSelection,
) -> Result<(), String> {
    validate_plugin_selections_exist(state, std::slice::from_ref(&selection))?;
    let profile = {
        let service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        service.get_profile(profile_id).map_err(error_to_string)?
    };
    let mut settings = profile.settings.unwrap_or_default();
    let advanced = settings.advanced.get_or_insert_with(ProfileAdvancedSettings::default);
    let mut selections = advanced.plugin_selections.clone().unwrap_or_default();
    if let Some(existing) = selections
        .iter_mut()
        .find(|item| item.package_id == selection.package_id)
    {
        existing.enabled = selection.enabled;
    } else {
        selections.push(selection);
    }
    let mut updated_settings = settings.clone();
    let updated_advanced = updated_settings
        .advanced
        .get_or_insert_with(ProfileAdvancedSettings::default);
    updated_advanced.plugin_selections = Some(dedup_plugin_selections(selections));
    {
        let service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        service
            .update_profile(
                profile_id,
                CreateProfileRequest {
                    name: profile.name.clone(),
                    group: trim_to_option_string(profile.group.clone()),
                    note: trim_to_option_string(profile.note.clone()),
                    proxy_id: None,
                    settings: Some(updated_settings.clone()),
                },
            )
            .map_err(error_to_string)?;
    }
    crate::commands::profile_commands::sync_profile_extension_state_from_settings_quietly(
        state,
        profile_id,
        Some(&updated_settings),
    );
    Ok(())
}

fn rewrite_profiles_referencing_package(state: &AppState, package_id: &str) -> Result<(), String> {
    let profiles = {
        let service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        service
            .list_profiles(crate::models::ListProfilesQuery {
                include_deleted: true,
                page: 1,
                page_size: 500,
                keyword: None,
                group: None,
                running: None,
            })
            .map_err(error_to_string)?
            .items
    };
    for profile in profiles {
        let referenced = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.advanced.as_ref())
            .and_then(|advanced| advanced.plugin_selections.as_ref())
            .map(|items| items.iter().any(|item| item.package_id == package_id))
            .unwrap_or(false);
        if !referenced {
            continue;
        }
        crate::commands::profile_commands::sync_profile_extension_state_from_settings_quietly(
            state,
            &profile.id,
            profile.settings.as_ref(),
        );
    }
    Ok(())
}

fn remove_package_from_all_profiles(state: &AppState, package_id: &str) -> Result<(), String> {
    let profiles = {
        let service = state
            .profile_service
            .lock()
            .map_err(|_| "profile service lock poisoned".to_string())?;
        service
            .list_profiles(crate::models::ListProfilesQuery {
                include_deleted: true,
                page: 1,
                page_size: 500,
                keyword: None,
                group: None,
                running: None,
            })
            .map_err(error_to_string)?
            .items
    };
    for profile in profiles {
        let mut settings = match profile.settings.clone() {
            Some(value) => value,
            None => continue,
        };
        let Some(advanced) = settings.advanced.as_mut() else {
            continue;
        };
        let before_len = advanced
            .plugin_selections
            .as_ref()
            .map(|items| items.len())
            .unwrap_or(0);
        let after = advanced
            .plugin_selections
            .clone()
            .unwrap_or_default()
            .into_iter()
            .filter(|item| item.package_id != package_id)
            .collect::<Vec<_>>();
        if before_len == after.len() {
            continue;
        }
        advanced.plugin_selections = Some(after);
        {
            let service = state
                .profile_service
                .lock()
                .map_err(|_| "profile service lock poisoned".to_string())?;
            service
                .update_profile(
                    &profile.id,
                    CreateProfileRequest {
                        name: profile.name.clone(),
                        group: trim_to_option_string(profile.group.clone()),
                        note: trim_to_option_string(profile.note.clone()),
                        proxy_id: None,
                        settings: Some(settings.clone()),
                    },
                )
                .map_err(error_to_string)?;
        }
        crate::commands::profile_commands::sync_profile_extension_state_from_settings_quietly(
            state,
            &profile.id,
            Some(&settings),
        );
    }
    Ok(())
}

fn normalize_extension_id(value: &str) -> Result<String, String> {
    let trimmed = value.trim().to_lowercase();
    if trimmed.len() != 32 || !trimmed.chars().all(|char| matches!(char, 'a'..='p')) {
        return Err("扩展 ID 必须是 32 位小写 a-p".to_string());
    }
    Ok(trimmed)
}

fn trim_to_option_string(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn error_to_string(error: AppError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};

    #[test]
    fn parse_update_manifest_extracts_version_and_codebase() {
        let parsed = parse_update_manifest(
            r#"<?xml version="1.0"?>
<gupdate protocol="2.0">
  <app appid="abcdefghijklmnopqrstuvwxyzaaaaaaaa">
    <updatecheck codebase="https://example.com/demo.crx" version="2.4.6" />
  </app>
</gupdate>"#,
        );
        assert_eq!(parsed.version.as_deref(), Some("2.4.6"));
        assert_eq!(parsed.codebase.as_deref(), Some("https://example.com/demo.crx"));
    }

    #[test]
    fn resolve_plugin_update_manifest_url_includes_required_webstore_params() {
        let url = resolve_plugin_update_manifest_url(
            "bpoadfkcbjbfhfodiogcnhhhpibjhbnh",
            "updatecheck",
        )
        .expect("resolve update manifest url");
        assert!(url.contains("response=updatecheck"));
        assert!(url.contains("prod=chromecrx"));
        assert!(url.contains("prodversion=999.0.0.0"));
        assert!(url.contains("acceptformat=crx3"));
        assert!(url.contains("installsource%3Dondemand"));
    }

    #[test]
    fn extract_zip_payload_supports_plain_zip_payload() {
        let bytes = b"PK\x03\x04demo".to_vec();
        let extracted = extract_zip_payload(&bytes).expect("extract zip payload");
        assert_eq!(extracted, bytes);
    }

    #[test]
    fn parse_downloaded_plugin_reads_manifest_name_and_version() {
        let mut buffer = Cursor::new(Vec::<u8>::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);
            let options = zip::write::SimpleFileOptions::default();
            writer
                .start_file("manifest.json", options)
                .expect("start manifest");
            writer
                .write_all(
                    br#"{
  "manifest_version": 3,
  "name": "Demo Plugin",
  "description": "Demo Desc",
  "version": "1.2.3",
  "icons": {
    "16": "icons/16.png",
    "128": "icons/128.png"
  }
}"#,
                )
                .expect("write manifest");
            writer
                .start_file("icons/128.png", options)
                .expect("start icon");
            writer.write_all(b"icon").expect("write icon");
            writer.finish().expect("finish zip");
        }

        let parsed =
            parse_downloaded_plugin("abcdefghijklmnopabcdefghijklmnop", &buffer.into_inner())
                .expect("parse plugin");
        assert_eq!(parsed.name, "Demo Plugin");
        assert_eq!(parsed.version, "1.2.3");
        assert_eq!(parsed.description.as_deref(), Some("Demo Desc"));
        assert_eq!(parsed.icon_relative_path.as_deref(), Some("icons/128.png"));
    }

    #[test]
    fn parse_store_listing_metadata_prefers_store_title_and_icon() {
        let parsed = parse_store_listing_metadata(
            r#"<html><head><title>Immersive Translate - Translate Web &amp; PDF - Chrome Web Store</title><meta property="og:title" content="Immersive Translate - Translate Web &amp; PDF - Chrome Web Store"><meta property="og:description" content="Free Translate Website"><meta property="og:image" content="https://lh3.googleusercontent.com/demo=s128"></head></html>"#,
        );
        assert_eq!(
            parsed.title.as_deref(),
            Some("Immersive Translate - Translate Web & PDF")
        );
        assert_eq!(parsed.description.as_deref(), Some("Free Translate Website"));
        assert_eq!(
            parsed.icon_url.as_deref(),
            Some("https://lh3.googleusercontent.com/demo=s128")
        );
    }

    #[test]
    fn normalize_optional_proxy_id_trims_empty_value_to_none() {
        assert_eq!(normalize_optional_proxy_id(None), None);
        assert_eq!(
            normalize_optional_proxy_id(Some("  px_000001  ".to_string())),
            Some("px_000001".to_string())
        );
        assert_eq!(normalize_optional_proxy_id(Some("   ".to_string())), None);
    }
}
