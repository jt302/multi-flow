use std::env;
use std::fs;
use std::io::ErrorKind;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::models::{
    ResourceActivateResponse, ResourceCatalogResponse, ResourceDownloadResponse,
    ResourceInstallResponse, ResourceItem,
};

const DEFAULT_CHROMIUM_ID: &str = "chromium-macos-144.0.7559.97";
const DEFAULT_GEOIP_ID: &str = "geoip-city-latest";
const DEFAULT_CHROMIUM_URL: &str = "https://pub-a864de27cbb94ddbb6df4bd821e5d544.r2.dev/chromium/chromium_144.0.7559.97.dmg";
const DEFAULT_GEOIP_URL: &str =
    "https://supabase-studio.webspaces.cc/storage/v1/object/public/multi-flow/GeoLite2-City.mmdb";
const MANIFEST_ENV: &str = "MULTI_FLOW_RESOURCE_MANIFEST_URL";

#[derive(Debug, Clone, Deserialize)]
struct ResourceManifest {
    resources: Vec<ManifestResource>,
}

#[derive(Debug, Clone, Deserialize)]
struct ManifestResource {
    id: String,
    kind: String,
    version: String,
    platform: String,
    url: String,
    file_name: String,
}

#[derive(Clone)]
pub struct ResourceService {
    data_dir: PathBuf,
}

impl ResourceService {
    pub fn from_app_handle(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .or_else(|_| app.path().app_data_dir())
            .map_err(|err| {
                AppError::Validation(format!("failed to resolve app data dir: {err}"))
            })?;
        fs::create_dir_all(&data_dir)?;
        Ok(Self { data_dir })
    }

    pub fn list_resources(&self) -> AppResult<ResourceCatalogResponse> {
        let (source, manifest) = self.load_manifest_with_fallback()?;
        let active_executable = self.resolve_active_chromium_executable();
        let mut items = Vec::with_capacity(manifest.resources.len());

        for resource in manifest.resources {
            let download_path = self.resolve_download_path(&resource);
            if resource.kind == "chromium" {
                let installed_executable =
                    self.resolve_chromium_installed_executable(&resource.version);
                let installed = installed_executable.is_file();
                let active = installed
                    && active_executable
                        .as_ref()
                        .map(|active_path| paths_equal(&installed_executable, active_path))
                        .unwrap_or(false);

                items.push(ResourceItem {
                    id: resource.id,
                    kind: resource.kind,
                    version: resource.version,
                    platform: resource.platform,
                    url: resource.url,
                    file_name: resource.file_name,
                    installed,
                    local_path: if installed {
                        Some(installed_executable.to_string_lossy().to_string())
                    } else if download_path.is_file() {
                        Some(download_path.to_string_lossy().to_string())
                    } else {
                        None
                    },
                    active,
                });
            } else {
                items.push(ResourceItem {
                    id: resource.id,
                    kind: resource.kind,
                    version: resource.version,
                    platform: resource.platform,
                    url: resource.url,
                    file_name: resource.file_name,
                    installed: download_path.is_file(),
                    local_path: download_path
                        .is_file()
                        .then(|| download_path.to_string_lossy().to_string()),
                    active: false,
                });
            }
        }

        Ok(ResourceCatalogResponse { source, items })
    }

    pub fn download_resource(
        &self,
        resource_id: &str,
        force: bool,
    ) -> AppResult<ResourceDownloadResponse> {
        self.download_resource_with_progress(resource_id, force, |_downloaded, _total| {})
    }

    pub fn download_resource_with_progress<F>(
        &self,
        resource_id: &str,
        force: bool,
        mut on_progress: F,
    ) -> AppResult<ResourceDownloadResponse>
    where
        F: FnMut(u64, Option<u64>),
    {
        let (_source, manifest) = self.load_manifest_with_fallback()?;
        let resource = manifest
            .resources
            .into_iter()
            .find(|item| item.id == resource_id)
            .ok_or_else(|| AppError::NotFound(format!("resource not found: {resource_id}")))?;

        let target_path = self.resolve_download_path(&resource);
        if !force && target_path.is_file() {
            let local_size = fs::metadata(&target_path)?.len();
            on_progress(local_size, Some(local_size));
            return Ok(ResourceDownloadResponse {
                id: resource.id,
                local_path: target_path.to_string_lossy().to_string(),
                bytes: local_size,
                skipped: true,
            });
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let temp_path = target_path.with_extension("download");
        let (bytes, _total) = crate::runtime_compat::block_on_compat(async {
            let client = reqwest::Client::builder()
                .user_agent("multi-flow-resource/0.1")
                .build()?;
            let mut response = client.get(&resource.url).send().await?.error_for_status()?;
            let total = response.content_length();
            let mut file = fs::File::create(&temp_path)?;
            let mut downloaded = 0u64;

            on_progress(downloaded, total);
            while let Some(chunk) = response.chunk().await? {
                file.write_all(&chunk)?;
                downloaded += chunk.len() as u64;
                on_progress(downloaded, total);
            }
            file.flush()?;
            Ok::<(u64, Option<u64>), AppError>((downloaded, total))
        })?;

        fs::rename(&temp_path, &target_path)?;
        let finalized_bytes = if bytes == 0 {
            fs::metadata(&target_path)?.len()
        } else {
            bytes
        };

        Ok(ResourceDownloadResponse {
            id: resource.id,
            local_path: target_path.to_string_lossy().to_string(),
            bytes: finalized_bytes,
            skipped: false,
        })
    }

    #[allow(dead_code)]
    pub fn install_chromium_resource(
        &self,
        resource_id: &str,
        force_download: bool,
        force_install: bool,
        activate: bool,
    ) -> AppResult<ResourceInstallResponse> {
        self.install_chromium_resource_with_progress(
            resource_id,
            force_download,
            force_install,
            activate,
            |_stage, _downloaded, _total| {},
        )
    }

    pub fn install_chromium_resource_with_progress<F>(
        &self,
        resource_id: &str,
        force_download: bool,
        force_install: bool,
        activate: bool,
        mut on_progress: F,
    ) -> AppResult<ResourceInstallResponse>
    where
        F: FnMut(&str, u64, Option<u64>),
    {
        let (_source, manifest) = self.load_manifest_with_fallback()?;
        let resource = manifest
            .resources
            .into_iter()
            .find(|item| item.id == resource_id)
            .ok_or_else(|| AppError::NotFound(format!("resource not found: {resource_id}")))?;

        if resource.kind != "chromium" {
            return Err(AppError::Validation(format!(
                "resource is not chromium: {resource_id}"
            )));
        }

        let existed = self
            .resolve_chromium_installed_executable(&resource.version)
            .is_file();
        let download = self.download_resource_with_progress(
            resource_id,
            force_download,
            |downloaded, total| {
                on_progress("download", downloaded, total);
            },
        )?;
        on_progress("install", download.bytes, Some(download.bytes));
        let executable = self.install_chromium_from_dmg(
            Path::new(&download.local_path),
            &resource.version,
            force_install,
        )?;

        let activated = if activate {
            self.activate_chromium_version(&resource.version)?;
            true
        } else {
            false
        };
        on_progress("done", download.bytes, Some(download.bytes));

        Ok(ResourceInstallResponse {
            id: resource.id,
            version: resource.version,
            executable_path: executable.to_string_lossy().to_string(),
            activated,
            skipped: existed && !force_install,
        })
    }

    pub fn activate_chromium_version(&self, version: &str) -> AppResult<ResourceActivateResponse> {
        let executable = self.resolve_chromium_installed_executable(version);
        if !executable.is_file() {
            return Err(AppError::NotFound(format!(
                "chromium executable not found for version: {version}"
            )));
        }

        let current_link = self.chromium_current_link();
        remove_path_if_exists(&current_link)?;

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(self.chromium_version_dir(version), &current_link)?;
        }

        #[cfg(not(unix))]
        {
            return Err(AppError::Validation(
                "chromium activation is only supported on unix-like systems".to_string(),
            ));
        }

        Ok(ResourceActivateResponse {
            version: version.to_string(),
            executable_path: executable.to_string_lossy().to_string(),
        })
    }

    pub fn resolve_geoip_database_path(&self) -> Option<PathBuf> {
        let default_geoip = self
            .data_dir
            .join("resources")
            .join("geoip")
            .join("GeoLite2-City.mmdb");
        if default_geoip.is_file() {
            return Some(default_geoip);
        }

        let Ok((_source, manifest)) = self.load_manifest_with_fallback() else {
            return None;
        };
        manifest
            .resources
            .iter()
            .filter(|item| item.kind == "geoip_mmdb")
            .map(|item| self.resolve_download_path(item))
            .find(|path| path.is_file())
    }

    pub fn ensure_geoip_database_available(&self) -> AppResult<PathBuf> {
        if let Some(path) = self.resolve_geoip_database_path() {
            return Ok(path);
        }

        let (_source, manifest) = self.load_manifest_with_fallback()?;
        let resource = manifest
            .resources
            .into_iter()
            .find(|item| item.kind == "geoip_mmdb")
            .ok_or_else(|| {
                AppError::NotFound("geoip resource not found in manifest".to_string())
            })?;

        let download = self.download_resource(&resource.id, false)?;
        Ok(PathBuf::from(download.local_path))
    }

    pub fn resolve_active_chromium_executable(&self) -> Option<PathBuf> {
        self.resolve_active_chromium_executable_inner()
    }

    pub fn resolve_chromium_executable_for_version(&self, version: &str) -> Option<PathBuf> {
        let executable = self.resolve_chromium_installed_executable(version);
        executable.is_file().then_some(executable)
    }

    pub fn host_platform(&self) -> &'static str {
        current_host_platform()
    }

    pub fn latest_host_compatible_chromium_version(&self) -> AppResult<Option<String>> {
        let resources = self.list_host_compatible_chromium_manifest_resources()?;
        Ok(resources
            .into_iter()
            .map(|item| item.version)
            .max_by(version_compare))
    }

    pub fn ensure_chromium_version_available<F>(
        &self,
        version: Option<&str>,
        mut on_progress: F,
    ) -> AppResult<(String, String, PathBuf)>
    where
        F: FnMut(&str, &str, u64, Option<u64>),
    {
        let resources = self.list_host_compatible_chromium_manifest_resources()?;
        if resources.is_empty() {
            return Err(AppError::Validation(format!(
                "current system has no chromium builds in manifest: {}",
                self.host_platform()
            )));
        }

        let target_resource = match version.and_then(trim_to_option_ref) {
            Some(target_version) => resources
                .into_iter()
                .find(|item| item.version == target_version)
                .ok_or_else(|| {
                    AppError::Validation(format!(
                        "current system has no chromium build for version {target_version}"
                    ))
                })?,
            None => resources
                .into_iter()
                .max_by(|left, right| version_compare(&left.version, &right.version))
                .ok_or_else(|| {
                    AppError::Validation(format!(
                        "current system has no chromium builds in manifest: {}",
                        self.host_platform()
                    ))
                })?,
        };

        if let Some(executable) =
            self.resolve_chromium_executable_for_version(&target_resource.version)
        {
            return Ok((target_resource.id, target_resource.version, executable));
        }

        let install = self.install_chromium_resource_with_progress(
            &target_resource.id,
            false,
            false,
            false,
            |stage, downloaded, total| {
                on_progress(&target_resource.id, stage, downloaded, total);
            },
        )?;

        Ok((
            target_resource.id,
            install.version,
            PathBuf::from(install.executable_path),
        ))
    }

    fn load_manifest_with_fallback(&self) -> AppResult<(String, ResourceManifest)> {
        if let Ok(url) = env::var(MANIFEST_ENV) {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                if let Ok(manifest) = self.fetch_manifest(trimmed) {
                    return Ok((format!("remote:{trimmed}"), manifest));
                }
            }
        }

        Ok(("builtin".to_string(), self.default_manifest()))
    }

    fn fetch_manifest(&self, url: &str) -> AppResult<ResourceManifest> {
        crate::runtime_compat::block_on_compat(async {
            let client = reqwest::Client::builder()
                .user_agent("multi-flow-manifest/0.1")
                .build()?;
            let response = client.get(url).send().await?.error_for_status()?;
            let manifest = response.json::<ResourceManifest>().await?;
            Ok::<ResourceManifest, reqwest::Error>(manifest)
        })
        .map_err(AppError::from)
    }

    fn default_manifest(&self) -> ResourceManifest {
        ResourceManifest {
            resources: vec![
                ManifestResource {
                    id: DEFAULT_CHROMIUM_ID.to_string(),
                    kind: "chromium".to_string(),
                    version: "144.0.7559.97".to_string(),
                    platform: "macos".to_string(),
                    url: DEFAULT_CHROMIUM_URL.to_string(),
                    file_name: "chromium_144.0.7559.97.dmg".to_string(),
                },
                ManifestResource {
                    id: DEFAULT_GEOIP_ID.to_string(),
                    kind: "geoip_mmdb".to_string(),
                    version: "latest".to_string(),
                    platform: "any".to_string(),
                    url: DEFAULT_GEOIP_URL.to_string(),
                    file_name: "GeoLite2-City.mmdb".to_string(),
                },
            ],
        }
    }

    fn list_host_compatible_chromium_manifest_resources(&self) -> AppResult<Vec<ManifestResource>> {
        let (_source, manifest) = self.load_manifest_with_fallback()?;
        let host_platform = self.host_platform();
        Ok(manifest
            .resources
            .into_iter()
            .filter(|item| item.kind == "chromium" && item.platform == host_platform)
            .collect())
    }

    fn resolve_download_path(&self, resource: &ManifestResource) -> PathBuf {
        let root = self.data_dir.join("resources");
        match resource.kind.as_str() {
            "chromium" => root
                .join("chromium")
                .join(&resource.version)
                .join(&resource.file_name),
            "geoip_mmdb" => root.join("geoip").join(&resource.file_name),
            _ => root
                .join("misc")
                .join(sanitize_id(&resource.id))
                .join(&resource.file_name),
        }
    }

    fn chromium_versions_root(&self) -> PathBuf {
        self.data_dir.join("chromium").join("versions")
    }

    fn chromium_version_dir(&self, version: &str) -> PathBuf {
        self.chromium_versions_root().join(version)
    }

    fn chromium_current_link(&self) -> PathBuf {
        self.data_dir.join("chromium").join("current")
    }

    fn resolve_chromium_installed_executable(&self, version: &str) -> PathBuf {
        self.chromium_version_dir(version)
            .join("Chromium.app")
            .join("Contents")
            .join("MacOS")
            .join("Chromium")
    }

    fn resolve_active_chromium_executable_inner(&self) -> Option<PathBuf> {
        let current = self.chromium_current_link();
        let candidate_a = current.join("Chromium.app/Contents/MacOS/Chromium");
        if candidate_a.is_file() {
            return Some(candidate_a);
        }

        let candidate_b = current.join("Contents/MacOS/Chromium");
        if candidate_b.is_file() {
            return Some(candidate_b);
        }

        None
    }

    #[cfg(target_os = "macos")]
    fn install_chromium_from_dmg(
        &self,
        dmg_path: &Path,
        version: &str,
        force_install: bool,
    ) -> AppResult<PathBuf> {
        let executable = self.resolve_chromium_installed_executable(version);
        if executable.is_file() && !force_install {
            return Ok(executable);
        }

        let version_dir = self.chromium_version_dir(version);
        if version_dir.exists() {
            fs::remove_dir_all(&version_dir)?;
        }
        fs::create_dir_all(&version_dir)?;

        let mount_point = self
            .data_dir
            .join("tmp")
            .join("mounts")
            .join(format!("chromium-{}", unique_id()));
        fs::create_dir_all(&mount_point)?;

        let attach_status = Command::new("hdiutil")
            .arg("attach")
            .arg(dmg_path)
            .arg("-nobrowse")
            .arg("-readonly")
            .arg("-mountpoint")
            .arg(&mount_point)
            .status()?;
        if !attach_status.success() {
            return Err(AppError::Validation(format!(
                "failed to attach dmg: {}",
                dmg_path.to_string_lossy()
            )));
        }

        let install_result = (|| -> AppResult<()> {
            let app_bundle = find_first_app_bundle(&mount_point)?.ok_or_else(|| {
                AppError::Validation("chromium app bundle not found in dmg mount".to_string())
            })?;

            let target_app = version_dir.join("Chromium.app");
            let status = Command::new("ditto")
                .arg(&app_bundle)
                .arg(&target_app)
                .status()?;
            if !status.success() {
                return Err(AppError::Validation(
                    "failed to copy chromium app".to_string(),
                ));
            }
            Ok(())
        })();

        let _ = Command::new("hdiutil")
            .arg("detach")
            .arg(&mount_point)
            .arg("-force")
            .status();

        install_result?;
        if !executable.is_file() {
            return Err(AppError::Validation(format!(
                "chromium executable not found after install: {}",
                executable.to_string_lossy()
            )));
        }
        Ok(executable)
    }

    #[cfg(not(target_os = "macos"))]
    fn install_chromium_from_dmg(
        &self,
        _dmg_path: &Path,
        _version: &str,
        _force_install: bool,
    ) -> AppResult<PathBuf> {
        Err(AppError::Validation(
            "chromium dmg install is currently supported on macos only".to_string(),
        ))
    }
}

fn remove_path_if_exists(path: &Path) -> AppResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || metadata.is_file() {
                fs::remove_file(path)?;
            } else if metadata.is_dir() {
                fs::remove_dir_all(path)?;
            }
            Ok(())
        }
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::Io(err)),
    }
}

fn paths_equal(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => false,
    }
}

fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn find_first_app_bundle(dir: &Path) -> AppResult<Option<PathBuf>> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("app"))
            .unwrap_or(false)
        {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn unique_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn current_host_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "linux"
    }
}

fn trim_to_option_ref(input: &str) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn version_compare(left: &String, right: &String) -> std::cmp::Ordering {
    compare_version_strings(left.as_str(), right.as_str())
}

fn compare_version_strings(left: &str, right: &str) -> std::cmp::Ordering {
    let left_parts = left
        .split('.')
        .map(|item| item.parse::<u32>().unwrap_or_default())
        .collect::<Vec<_>>();
    let right_parts = right
        .split('.')
        .map(|item| item.parse::<u32>().unwrap_or_default())
        .collect::<Vec<_>>();
    let max_len = left_parts.len().max(right_parts.len());
    for index in 0..max_len {
        let left_value = *left_parts.get(index).unwrap_or(&0);
        let right_value = *right_parts.get(index).unwrap_or(&0);
        match left_value.cmp(&right_value) {
            std::cmp::Ordering::Equal => {}
            ordering => return ordering,
        }
    }
    std::cmp::Ordering::Equal
}

#[cfg(test)]
impl ResourceService {
    pub fn from_data_dir(data_dir: impl AsRef<Path>) -> AppResult<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        fs::create_dir_all(&data_dir)?;
        Ok(Self { data_dir })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn builtin_manifest_contains_chromium_and_geoip() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("multi-flow-resource-test-{unique}"));
        let service = ResourceService::from_data_dir(&temp_dir).expect("service");

        let catalog = service.list_resources().expect("catalog");
        assert_eq!(catalog.source, "builtin");
        assert!(catalog
            .items
            .iter()
            .any(|item| item.id == DEFAULT_CHROMIUM_ID));
        assert!(catalog.items.iter().any(|item| item.id == DEFAULT_GEOIP_ID));

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[cfg(unix)]
    #[test]
    fn activate_chromium_version_updates_current_symlink() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("multi-flow-active-test-{unique}"));
        let service = ResourceService::from_data_dir(&temp_dir).expect("service");

        let version = "144.0.7559.97";
        let executable = service.resolve_chromium_installed_executable(version);
        fs::create_dir_all(
            executable
                .parent()
                .expect("chromium executable parent should exist"),
        )
        .expect("create executable parent");
        fs::write(&executable, b"fake-binary").expect("write fake executable");

        let activated = service
            .activate_chromium_version(version)
            .expect("activate version");
        assert_eq!(activated.version, version);
        assert!(Path::new(&activated.executable_path).is_file());
        let active = service
            .resolve_active_chromium_executable()
            .expect("active executable");
        assert!(paths_equal(&active, &executable));

        let _ = fs::remove_dir_all(temp_dir);
    }
}
