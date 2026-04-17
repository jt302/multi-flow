use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use reqwest::Url;
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
    /// CAPTCHA 求解服务配置列表
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    captcha_solver_configs: Vec<crate::services::captcha_service::CaptchaSolverConfig>,
    /// AI 聊天全局提示词（在所有聊天中生效）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ai_chat_global_prompt: Option<String>,
    /// 工具确认覆盖设置：tool_name → require_confirmation
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    tool_confirmation_overrides: HashMap<String, bool>,
    /// 全局默认 AI 配置 ID
    #[serde(default, skip_serializing_if = "Option::is_none")]
    default_ai_config_id: Option<String>,
    /// Dev 模式 Chromium 可执行文件路径覆盖（仅开发环境生效）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    dev_chromium_executable: Option<String>,
    /// 应用界面语言，同时作为原生菜单语言真相源
    #[serde(default, skip_serializing_if = "Option::is_none")]
    app_language: Option<String>,
    /// 全局默认启动 URL（profile 未配置时作为 fallback；None 表示使用空标签页）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    global_default_startup_url: Option<String>,
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
            captcha_solver_configs: Vec::new(),
            ai_chat_global_prompt: None,
            tool_confirmation_overrides: HashMap::new(),
            default_ai_config_id: None,
            dev_chromium_executable: None,
            app_language: None,
            global_default_startup_url: None,
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
    /// Agent prompt 语言: "zh" | "en"，默认 "zh"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
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

    pub fn read_global_default_startup_url(&self) -> AppResult<Option<String>> {
        Ok(self.read_preferences_file()?.global_default_startup_url)
    }

    pub fn save_global_default_startup_url(&self, url: Option<String>) -> AppResult<()> {
        let trimmed = url
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        // 验证并规范化 URL（URL 解析会将 scheme 规范化为小写，避免大写 "Https://" 在启动时匹配失败）
        let canonical = if let Some(ref value) = trimmed {
            let parsed = Url::parse(value).map_err(|_| {
                AppError::Validation(format!(
                    "global default startup URL must be a valid http/https URL: {value}"
                ))
            })?;
            let scheme = parsed.scheme();
            if scheme != "http" && scheme != "https" {
                return Err(AppError::Validation(format!(
                    "global default startup URL must start with http:// or https://: {value}"
                )));
            }
            if parsed.host_str().is_none() {
                return Err(AppError::Validation(format!(
                    "global default startup URL must contain a valid host: {value}"
                )));
            }
            Some(parsed.to_string())
        } else {
            None
        };
        let mut preferences = self.read_preferences_file()?;
        preferences.global_default_startup_url = canonical;
        self.write_preferences_file(&preferences)
    }

    pub fn read_app_language(&self) -> AppResult<Option<String>> {
        Ok(self
            .read_preferences_file()?
            .app_language
            .map(|value| normalize_app_language(&value).to_string()))
    }

    pub fn save_app_language(&self, locale: Option<String>) -> AppResult<Option<String>> {
        let mut preferences = self.read_preferences_file()?;
        let normalized =
            trim_to_option(locale).map(|value| normalize_app_language(&value).to_string());
        preferences.app_language = normalized.clone();
        self.write_preferences_file(&preferences)?;
        Ok(normalized)
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
                        locale: legacy.locale,
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

    pub fn get_default_ai_config_id(&self) -> AppResult<Option<String>> {
        Ok(self.read_preferences_file()?.default_ai_config_id)
    }

    pub fn set_default_ai_config_id(&self, config_id: Option<String>) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.default_ai_config_id = config_id;
        self.write_preferences_file(&preferences)
    }

    // ── CAPTCHA solver config CRUD ───────────────────────────────────

    pub fn list_captcha_configs(
        &self,
    ) -> AppResult<Vec<crate::services::captcha_service::CaptchaSolverConfig>> {
        let prefs = self.read_preferences_file()?;
        Ok(prefs.captcha_solver_configs)
    }

    pub fn get_default_captcha_config(
        &self,
    ) -> Result<Option<crate::services::captcha_service::CaptchaSolverConfig>, String> {
        let prefs = self.read_preferences_file().map_err(|e| e.to_string())?;
        Ok(prefs
            .captcha_solver_configs
            .iter()
            .find(|c| c.is_default)
            .cloned()
            .or_else(|| prefs.captcha_solver_configs.into_iter().next()))
    }

    pub fn create_captcha_config(
        &self,
        mut entry: crate::services::captcha_service::CaptchaSolverConfig,
    ) -> AppResult<crate::services::captcha_service::CaptchaSolverConfig> {
        let mut prefs = self.read_preferences_file()?;
        entry.id = uuid::Uuid::new_v4().to_string();
        if prefs.captcha_solver_configs.is_empty() {
            entry.is_default = true;
        }
        prefs.captcha_solver_configs.push(entry.clone());
        self.write_preferences_file(&prefs)?;
        Ok(entry)
    }

    pub fn update_captcha_config(
        &self,
        entry: crate::services::captcha_service::CaptchaSolverConfig,
    ) -> AppResult<()> {
        let mut prefs = self.read_preferences_file()?;
        if let Some(existing) = prefs
            .captcha_solver_configs
            .iter_mut()
            .find(|c| c.id == entry.id)
        {
            existing.provider = entry.provider;
            existing.api_key = entry.api_key;
            existing.base_url = entry.base_url;
            existing.is_default = entry.is_default;
        } else {
            return Err(AppError::Validation(format!(
                "Captcha config not found: {}",
                entry.id
            )));
        }
        self.write_preferences_file(&prefs)
    }

    pub fn delete_captcha_config(&self, id: &str) -> AppResult<()> {
        let mut prefs = self.read_preferences_file()?;
        let before_len = prefs.captcha_solver_configs.len();
        prefs.captcha_solver_configs.retain(|c| c.id != id);
        if prefs.captcha_solver_configs.len() == before_len {
            return Err(AppError::Validation(format!(
                "Captcha config not found: {id}"
            )));
        }
        self.write_preferences_file(&prefs)
    }

    // ── AI Chat global prompt ────────────────────────────────────────

    pub fn read_ai_chat_global_prompt(&self) -> AppResult<Option<String>> {
        Ok(self.read_preferences_file()?.ai_chat_global_prompt)
    }

    pub fn save_ai_chat_global_prompt(&self, prompt: Option<String>) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.ai_chat_global_prompt = trim_to_option(prompt);
        self.write_preferences_file(&preferences)
    }

    // ── Dev 模式 Chromium 可执行文件覆盖 ───────────────────────────────

    pub fn read_dev_chromium_executable(&self) -> AppResult<Option<String>> {
        Ok(self.read_preferences_file()?.dev_chromium_executable)
    }

    pub fn save_dev_chromium_executable(&self, path: Option<String>) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences.dev_chromium_executable = path.and_then(|p| {
            let trimmed = p.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });
        self.write_preferences_file(&preferences)
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

    // ── 工具确认覆盖设置 ────────────────────────────────────────────

    /// 获取工具确认覆盖设置（tool_name → require_confirmation）
    pub fn get_tool_confirmation_overrides(&self) -> HashMap<String, bool> {
        self.read_preferences_file()
            .map(|p| p.tool_confirmation_overrides)
            .unwrap_or_default()
    }

    /// 设置单个工具的确认覆盖
    pub fn set_tool_confirmation_override(
        &self,
        tool_name: &str,
        require_confirmation: bool,
    ) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        preferences
            .tool_confirmation_overrides
            .insert(tool_name.to_string(), require_confirmation);
        self.write_preferences_file(&preferences)
    }

    /// 批量设置所有危险工具的确认状态
    pub fn set_all_tool_confirmation_overrides(&self, require_confirmation: bool) -> AppResult<()> {
        let mut preferences = self.read_preferences_file()?;
        for tool_name in crate::services::ai_tools::all_dangerous_tool_names() {
            preferences
                .tool_confirmation_overrides
                .insert(tool_name.to_string(), require_confirmation);
        }
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

pub(crate) fn normalize_app_language(locale: &str) -> &'static str {
    let normalized = locale.trim().to_ascii_lowercase();
    if normalized.starts_with("en") {
        "en-US"
    } else {
        "zh-CN"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_app_language_maps_supported_variants() {
        assert_eq!(normalize_app_language("zh-CN"), "zh-CN");
        assert_eq!(normalize_app_language("zh-Hans"), "zh-CN");
        assert_eq!(normalize_app_language("zh"), "zh-CN");
        assert_eq!(normalize_app_language("en-US"), "en-US");
        assert_eq!(normalize_app_language("en-GB"), "en-US");
        assert_eq!(normalize_app_language("en"), "en-US");
        assert_eq!(normalize_app_language("fr-FR"), "zh-CN");
    }

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

    #[test]
    fn app_preference_service_persists_normalized_app_language() {
        let unique = format!("multi-flow-app-language-test-{}", crate::models::now_ts());
        let temp_dir = std::env::temp_dir().join(unique);
        let _ = std::fs::remove_dir_all(&temp_dir);
        let service = AppPreferenceService::from_data_dir(temp_dir.clone());

        service
            .save_app_language(Some("en-GB".to_string()))
            .expect("save app language");

        let saved = service.read_app_language().expect("read app language");
        assert_eq!(saved.as_deref(), Some("en-US"));

        service
            .save_app_language(Some("".to_string()))
            .expect("clear app language");
        let cleared = service
            .read_app_language()
            .expect("read cleared app language");
        assert_eq!(cleared, None);

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
