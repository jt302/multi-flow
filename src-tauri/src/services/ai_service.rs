use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::app_preference_service::AiProviderConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: ChatContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ChatContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text { text: String },
    ImageUrl { image_url: ImageUrl },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageUrl {
    pub url: String,
}

pub struct AiService {
    http: reqwest::Client,
}

impl AiService {
    pub fn new(http: reqwest::Client) -> Self {
        Self { http }
    }

    /// 调用 OpenAI 兼容接口，返回第一条 assistant 消息的文本
    pub async fn chat(
        &self,
        config: &AiProviderConfig,
        messages: Vec<ChatMessage>,
        response_format: Option<Value>,
    ) -> Result<String, String> {
        let base_url = config.base_url.as_deref()
            .unwrap_or("https://api.openai.com/v1")
            .trim_end_matches('/');
        let api_key = config.api_key.as_deref().unwrap_or("");
        let model = config.model.as_deref().unwrap_or("gpt-4o");

        let mut body = json!({
            "model": model,
            "messages": messages,
        });
        if let Some(fmt) = response_format {
            body["response_format"] = fmt;
        }

        let mut req = self.http
            .post(format!("{base_url}/chat/completions"))
            .header("Content-Type", "application/json")
            .json(&body);
        if !api_key.is_empty() {
            req = req.bearer_auth(api_key);
        }

        let resp = req.send().await
            .map_err(|e| format!("AI request failed: {e}"))?;
        let status = resp.status();
        let text = resp.text().await
            .map_err(|e| format!("AI read body failed: {e}"))?;
        if !status.is_success() {
            return Err(format!("AI API error {status}: {text}"));
        }
        let parsed: Value = serde_json::from_str(&text)
            .map_err(|e| format!("AI response parse failed: {e}"))?;
        let content = parsed
            .get("choices").and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        Ok(content)
    }
}

/// 从变量中获取 base64 图片并构造 vision 消息内容
pub fn build_vision_content(text_prompt: &str, image_base64: Option<&str>) -> ChatContent {
    match image_base64 {
        None => ChatContent::Text(text_prompt.to_string()),
        Some(b64) => {
            // 判断格式（默认 png）
            let data_url = if b64.starts_with("data:") {
                b64.to_string()
            } else {
                format!("data:image/png;base64,{b64}")
            };
            ChatContent::Parts(vec![
                ContentPart::Text { text: text_prompt.to_string() },
                ContentPart::ImageUrl { image_url: ImageUrl { url: data_url } },
            ])
        }
    }
}

/// 按点分路径从 JSON Value 中提取字符串值
pub fn extract_json_path(value: &Value, path: &str) -> Option<String> {
    let mut current = value;
    for key in path.split('.') {
        current = if let Ok(idx) = key.parse::<usize>() {
            current.as_array()?.get(idx)?
        } else {
            current.as_object()?.get(key)?
        };
    }
    Some(match current {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    })
}
