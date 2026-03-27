use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

const PREFERENCES_DIR: &str = "preferences";
const PREFERENCES_FILE_NAME: &str = "app-preferences.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppPreferencesFile {
    plugin_download_proxy_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ai_provider: Option<AiProviderConfig>,
}

/// AI Provider 配置（OpenAI 兼容接口）
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    /// 接口 base URL，默认 "https://api.openai.com/v1"
    pub base_url: Option<String>,
    /// API Key
    pub api_key: Option<String>,
    /// 默认模型，默认 "gpt-4o"
    pub model: Option<String>,
}

pub struct AppPreferenceService {
    file_path: PathBuf,
}

impl AppPreferenceService {
    pub fn from_app_handle(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .or_else(|_| app.path().app_data_dir())
            .map_err(|err| {
                AppError::Validation(format!("failed to resolve app data dir: {err}"))
            })?;
        Ok(Self::from_data_dir(data_dir))
    }

    pub fn from_data_dir(data_dir: PathBuf) -> Self {
        let file_path = data_dir
            .join(PREFERENCES_DIR)
            .join(PREFERENCES_FILE_NAME);
        Self { file_path }
    }

    pub fn read_plugin_download_proxy_id(&self) -> AppResult<Option<String>> {
        Ok(self.read_preferences_file()?.plugin_download_proxy_id)
    }

    pub fn save_plugin_download_proxy_id(&self, proxy_id: Option<String>) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.plugin_download_proxy_id = trim_to_option(proxy_id);
        self.write_preferences_file(&preferences)
    }

    pub fn read_ai_provider_config(&self) -> AppResult<AiProviderConfig> {
        Ok(self.read_preferences_file()?.ai_provider.unwrap_or_default())
    }

    pub fn save_ai_provider_config(&self, config: AiProviderConfig) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.ai_provider = Some(config);
        self.write_preferences_file(&preferences)
    }

    fn read_preferences_file(&self) -> AppResult<AppPreferencesFile> {
        if !self.file_path.is_file() {
            return Ok(AppPreferencesFile::default());
        }
        let content = fs::read_to_string(&self.file_path)?;
        if content.trim().is_empty() {
            return Ok(AppPreferencesFile::default());
        }
        serde_json::from_str(&content).map_err(AppError::from)
    }

    fn write_preferences_file(&self, preferences: &AppPreferencesFile) -> AppResult<()> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(preferences)?;
        fs::write(&self.file_path, format!("{content}\n"))?;
        Ok(())
    }
}

fn trim_to_option(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_preference_service_persists_plugin_download_proxy_id() {
        let unique = format!(
            "multi-flow-app-preference-service-test-{}",
            crate::models::now_ts()
        );
        let temp_dir = std::env::temp_dir().join(unique);
        let _ = std::fs::remove_dir_all(&temp_dir);
        let service = AppPreferenceService::from_data_dir(temp_dir.clone());

        service
            .save_plugin_download_proxy_id(Some("px_demo".to_string()))
            .expect("save plugin download proxy id");

        let saved = service
            .read_plugin_download_proxy_id()
            .expect("read plugin download proxy id");
        assert_eq!(saved.as_deref(), Some("px_demo"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn app_preference_service_returns_none_when_preference_file_missing() {
        let unique = format!(
            "multi-flow-app-preference-missing-test-{}",
            crate::models::now_ts()
        );
        let temp_dir = std::env::temp_dir().join(unique);
        let _ = std::fs::remove_dir_all(&temp_dir);
        let service = AppPreferenceService::from_data_dir(temp_dir.clone());

        let saved = service
            .read_plugin_download_proxy_id()
            .expect("read plugin download proxy id");
        assert_eq!(saved, None);

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
