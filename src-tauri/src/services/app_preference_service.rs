use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

const PREFERENCES_DIR: &str = "preferences";
const PREFERENCES_FILE_NAME: &str = "app-preferences.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppPreferencesFile {
    plugin_download_proxy_id: Option<String>,
    /// Legacy single AI provider config (kept for deserialization backward compat)
    #[serde(skip_serializing_if = "Option::is_none")]
    ai_provider: Option<AiProviderConfig>,
    /// Multi-model AI config list (new)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    ai_configs: Vec<AiConfigEntry>,
    /// Chromium 日志开关，默认 true（启用 --enable-logging=stderr --v=1）
    #[serde(default = "default_true")]
    chromium_logging_enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppPreferencesFile {
    fn default() -> Self {
        Self {
            plugin_download_proxy_id: None,
            ai_provider: None,
            ai_configs: Vec::new(),
            chromium_logging_enabled: true,
        }
    }
}

/// AI Provider 配置
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    /// Provider 类型: "openai"|"openrouter"|"deepseek"|"groq"|"together"|"ollama"|"anthropic"|"gemini"|"custom"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// 接口 base URL（覆盖 provider 默认值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// API Key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// 默认模型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

/// Named AI config entry (multi-model management)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigEntry {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
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
        let file_path = data_dir.join(PREFERENCES_DIR).join(PREFERENCES_FILE_NAME);
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
        Ok(self
            .read_preferences_file()?
            .ai_provider
            .unwrap_or_default())
    }

    pub fn save_ai_provider_config(&self, config: AiProviderConfig) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.ai_provider = Some(config);
        self.write_preferences_file(&preferences)
    }

    // ── Multi-model AI config CRUD ─────────────────────────────────────

    /// List all AI config entries. Auto-migrates legacy single config.
    pub fn list_ai_configs(&self) -> AppResult<Vec<AiConfigEntry>> {
        let mut preferences = self.read_preferences_file()?;
        // Migrate legacy ai_provider into ai_configs if needed
        if preferences.ai_configs.is_empty() {
            if let Some(legacy) = preferences.ai_provider.take() {
                let has_content = legacy.provider.is_some()
                    || legacy.base_url.is_some()
                    || legacy.api_key.is_some()
                    || legacy.model.is_some();
                if has_content {
                    let entry = AiConfigEntry {
                        id: Uuid::new_v4().to_string(),
                        name: "默认配置".to_string(),
                        provider: legacy.provider,
                        base_url: legacy.base_url,
                        api_key: legacy.api_key,
                        model: legacy.model,
                    };
                    preferences.ai_configs.push(entry);
                    self.write_preferences_file(&preferences)?;
                }
            }
        }
        Ok(preferences.ai_configs)
    }

    pub fn create_ai_config(&self, entry: AiConfigEntry) -> AppResult<AiConfigEntry> {
        let mut preferences = self.read_preferences_file()?;
        let entry = AiConfigEntry {
            id: Uuid::new_v4().to_string(),
            ..entry
        };
        preferences.ai_configs.push(entry.clone());
        self.write_preferences_file(&preferences)?;
        Ok(entry)
    }

    pub fn update_ai_config(&self, entry: AiConfigEntry) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        if let Some(existing) = preferences.ai_configs.iter_mut().find(|e| e.id == entry.id) {
            *existing = entry;
            self.write_preferences_file(&preferences)?;
            Ok(())
        } else {
            Err(AppError::Validation(format!(
                "AI config not found: {}",
                entry.id
            )))
        }
    }

    pub fn delete_ai_config(&self, id: &str) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        let before_len = preferences.ai_configs.len();
        preferences.ai_configs.retain(|e| e.id != id);
        if preferences.ai_configs.len() == before_len {
            return Err(AppError::Validation(format!("AI config not found: {id}")));
        }
        self.write_preferences_file(&preferences)
    }

    pub fn find_ai_config_by_id(&self, id: &str) -> AppResult<Option<AiConfigEntry>> {
        let preferences = self.read_preferences_file()?;
        Ok(preferences.ai_configs.into_iter().find(|e| e.id == id))
    }

    // ── Chromium logging toggle ──────────────────────────────────────

    pub fn read_chromium_logging_enabled(&self) -> AppResult<bool> {
        Ok(self.read_preferences_file()?.chromium_logging_enabled)
    }

    pub fn save_chromium_logging_enabled(&self, enabled: bool) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.chromium_logging_enabled = enabled;
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
