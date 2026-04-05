use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::app_preference_service::AiProviderConfig;

fn default_base_url(provider: &str) -> &'static str {
    match provider {
        "openai" => "https://api.openai.com/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        "deepseek" => "https://api.deepseek.com/v1",
        "groq" => "https://api.groq.com/openai/v1",
        "together" => "https://api.together.xyz/v1",
        "ollama" => "http://localhost:11434/v1",
        "anthropic" => "https://api.anthropic.com",
        "gemini" => "https://generativelanguage.googleapis.com",
        _ => "https://api.openai.com/v1",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: ChatContent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl ChatMessage {
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: ChatContent::Text(content.into()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    }
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: ChatContent::Text(content.into()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: ChatContent::Text(content.into()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    }
    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: "tool".into(),
            content: ChatContent::Text(content.into()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
            name: None,
        }
    }
    /// 带图片的工具结果（截图 → 视觉注入）
    pub fn tool_result_with_image(
        tool_call_id: impl Into<String>,
        text: impl Into<String>,
        image_base64: &str,
    ) -> Self {
        let data_url = if image_base64.starts_with("data:") {
            image_base64.to_string()
        } else {
            format!("data:image/png;base64,{image_base64}")
        };
        Self {
            role: "tool".into(),
            content: ChatContent::Parts(vec![
                ContentPart::Text { text: text.into() },
                ContentPart::ImageUrl {
                    image_url: ImageUrl { url: data_url },
                },
            ]),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
            name: None,
        }
    }
    pub fn with_content(role: impl Into<String>, content: ChatContent) -> Self {
        Self {
            role: role.into(),
            content,
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    }
}

/// Token 使用量统计
#[derive(Debug, Clone, Default, Serialize)]
pub struct TokenUsage {
    pub prompt_tokens: Option<i32>,
    pub completion_tokens: Option<i32>,
}

/// AI 工具调用结果
pub enum AiChatResult {
    /// 模型返回文本（无 tool_calls）
    Text(String, TokenUsage),
    /// 模型请求调用工具（text 为伴随工具调用的回复文本，部分模型会返回思考/解释内容）
    ToolCalls {
        text: String,
        calls: Vec<AiToolCall>,
        usage: TokenUsage,
    },
}

#[derive(Debug, Clone)]
pub struct AiToolCall {
    pub id: String,
    /// 工具名称（对应 ScriptStep 的 kind）
    pub name: String,
    /// 工具参数 JSON（字段对应 ScriptStep 变体的字段，不含 kind）
    pub arguments: Value,
    /// 原始 tool_call Value（用于追加到消息历史）
    pub raw: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ChatContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

impl std::fmt::Display for ChatContent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatContent::Text(t) => write!(f, "{}", t),
            ChatContent::Parts(parts) => {
                for p in parts {
                    match p {
                        ContentPart::Text { text } => write!(f, "{}", text)?,
                        ContentPart::ImageUrl { .. } => write!(f, "[image]")?,
                    }
                }
                Ok(())
            }
        }
    }
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

const MAX_AI_RETRIES: u32 = 5;

/// 判断 HTTP 状态码是否可重试（速率限制、服务端错误）
fn is_retryable_status(status: u16) -> bool {
    matches!(status, 429 | 500 | 502 | 503 | 529)
}

/// 指数退避延迟（1s, 2s, 4s, 8s, 16s）
fn retry_delay(attempt: u32) -> std::time::Duration {
    std::time::Duration::from_secs(1u64 << attempt)
}

/// 格式化重试消息（用于日志和返回给上层）
pub fn format_retry_message(attempt: u32, max: u32, error: &str) -> String {
    let delay = 1u64 << attempt;
    format!("AI request failed (attempt {}/{max}), retrying in {delay}s: {error}", attempt + 1)
}

pub struct AiService {
    http: reqwest::Client,
}

impl AiService {
    pub fn new(http: reqwest::Client) -> Self {
        Self { http }
    }

    pub fn with_timeout(timeout_secs: u64) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client");
        Self { http }
    }

    /// 调用 OpenAI 兼容接口，返回第一条 assistant 消息的文本
    pub async fn chat(
        &self,
        config: &AiProviderConfig,
        messages: Vec<ChatMessage>,
        response_format: Option<Value>,
    ) -> Result<String, String> {
        let provider = config.provider.as_deref().unwrap_or("openai");
        let resolved_base = config
            .base_url
            .as_deref()
            .unwrap_or_else(|| default_base_url(provider));
        let base_url = resolved_base.trim_end_matches('/');
        let api_key = config.api_key.as_deref().unwrap_or("");

        if provider == "anthropic" {
            let model = config.model.as_deref().unwrap_or("claude-opus-4-5");
            return self
                .chat_anthropic(base_url, api_key, model, &messages)
                .await;
        }
        if provider == "gemini" {
            let model = config.model.as_deref().unwrap_or("gemini-2.0-flash");
            return self.chat_gemini(base_url, api_key, model, &messages).await;
        }

        let model = config.model.as_deref().unwrap_or("gpt-4o");

        let mut body = json!({
            "model": model,
            "messages": messages,
        });
        if let Some(fmt) = response_format {
            body["response_format"] = fmt;
        }

        let resp_text = self.post_chat(base_url, api_key, &body).await?;
        let parsed: Value = serde_json::from_str(&resp_text)
            .map_err(|e| format!("AI response parse failed: {e}"))?;
        let content = parsed
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        Ok(content)
    }

    /// 支持 tool_calls 的 chat，返回文本或工具调用列表
    pub async fn chat_with_tools(
        &self,
        config: &AiProviderConfig,
        messages: &[ChatMessage],
        tools: &[Value],
    ) -> Result<AiChatResult, String> {
        let provider = config.provider.as_deref().unwrap_or("openai");
        let resolved_base = config
            .base_url
            .as_deref()
            .unwrap_or_else(|| default_base_url(provider));
        let base_url = resolved_base.trim_end_matches('/');
        let api_key = config.api_key.as_deref().unwrap_or("");

        if provider == "anthropic" {
            let model = config.model.as_deref().unwrap_or("claude-opus-4-5");
            return self
                .chat_with_tools_anthropic(base_url, api_key, model, messages, tools)
                .await;
        }
        if provider == "gemini" {
            // Gemini 暂不支持 tool_calls，退回文本
            let model = config.model.as_deref().unwrap_or("gemini-2.0-flash");
            let text = self.chat_gemini(base_url, api_key, model, messages).await?;
            return Ok(AiChatResult::Text(text, TokenUsage::default()));
        }

        let model = config.model.as_deref().unwrap_or("gpt-4o");

        let body = json!({
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        });

        let resp_text = self.post_chat(base_url, api_key, &body).await?;
        let parsed: Value = serde_json::from_str(&resp_text)
            .map_err(|e| format!("AI response parse failed: {e}"))?;

        // 提取 usage
        let usage = extract_usage(&parsed);

        let choice = parsed
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .ok_or_else(|| "AI response: no choices".to_string())?;

        let finish_reason = choice
            .get("finish_reason")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let message = choice
            .get("message")
            .ok_or_else(|| "AI response: no message".to_string())?;

        if finish_reason == "tool_calls" {
            // 提取伴随工具调用的回复文本（模型的思考/解释内容）
            let assistant_text = message
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let calls_raw = message
                .get("tool_calls")
                .and_then(|v| v.as_array())
                .ok_or_else(|| {
                    "AI response: finish_reason=tool_calls but no tool_calls array".to_string()
                })?;

            let calls = calls_raw
                .iter()
                .filter_map(|tc| {
                    let id = tc.get("id")?.as_str()?.to_string();
                    let func = tc.get("function")?;
                    let name = func.get("name")?.as_str()?.to_string();
                    let args_str = func.get("arguments")?.as_str().unwrap_or("{}");
                    let arguments: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                    Some(AiToolCall {
                        id,
                        name,
                        arguments,
                        raw: tc.clone(),
                    })
                })
                .collect::<Vec<_>>();

            Ok(AiChatResult::ToolCalls {
                text: assistant_text,
                calls,
                usage: usage.clone(),
            })
        } else {
            let content = message
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Ok(AiChatResult::Text(content, usage))
        }
    }

    async fn post_chat(
        &self,
        base_url: &str,
        api_key: &str,
        body: &Value,
    ) -> Result<String, String> {
        let mut last_err = String::new();
        for attempt in 0..MAX_AI_RETRIES {
            let mut req = self
                .http
                .post(format!("{base_url}/chat/completions"))
                .header("Content-Type", "application/json")
                .json(body);
            if !api_key.is_empty() {
                req = req.bearer_auth(api_key);
            }
            match req.send().await {
                Err(e) => {
                    last_err = format!("AI request failed: {e}");
                    if attempt < MAX_AI_RETRIES - 1 {
                        eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                        tokio::time::sleep(retry_delay(attempt)).await;
                        continue;
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await
                        .map_err(|e| format!("AI read body failed: {e}"))?;
                    if status.is_success() {
                        return Ok(text);
                    }
                    last_err = format!("AI API error {status}: {text}");
                    if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                        eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                        tokio::time::sleep(retry_delay(attempt)).await;
                        continue;
                    }
                    return Err(last_err);
                }
            }
        }
        Err(last_err)
    }

    /// Anthropic Messages API 适配器（text only）
    async fn chat_anthropic(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<String, String> {
        let system_text: String = messages
            .iter()
            .filter(|m| m.role == "system")
            .map(|m| match &m.content {
                ChatContent::Text(t) => t.clone(),
                ChatContent::Parts(parts) => parts
                    .iter()
                    .filter_map(|p| {
                        if let ContentPart::Text { text } = p {
                            Some(text.clone())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n"),
            })
            .collect::<Vec<_>>()
            .join("\n");

        let non_system: Vec<Value> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|m| {
                let role = if m.role == "assistant" {
                    "assistant"
                } else {
                    "user"
                };
                let text = match &m.content {
                    ChatContent::Text(t) => t.clone(),
                    ChatContent::Parts(parts) => parts
                        .iter()
                        .filter_map(|p| {
                            if let ContentPart::Text { text } = p {
                                Some(text.clone())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n"),
                };
                json!({"role": role, "content": [{"type": "text", "text": text}]})
            })
            .collect();

        let mut body = json!({
            "model": model,
            "max_tokens": 4096,
            "messages": non_system,
        });
        if !system_text.is_empty() {
            body["system"] = json!(system_text);
        }

        let text = {
            let mut last_err = String::new();
            let mut result_text: Option<String> = None;
            for attempt in 0..MAX_AI_RETRIES {
                match self.http
                    .post(format!("{base_url}/v1/messages"))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", api_key)
                    .header("anthropic-version", "2023-10-01")
                    .json(&body)
                    .send()
                    .await
                {
                    Err(e) => {
                        last_err = format!("Anthropic request failed: {e}");
                        if attempt < MAX_AI_RETRIES - 1 {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp.text().await
                            .map_err(|e| format!("Anthropic read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Anthropic API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                        return Err(last_err);
                    }
                }
            }
            result_text.ok_or(last_err)?
        };

        let parsed: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Anthropic response parse failed: {e}"))?;
        let content = parsed
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
            })
            .and_then(|b| b.get("text"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();
        Ok(content)
    }

    /// Anthropic Messages API 工具调用适配器
    async fn chat_with_tools_anthropic(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        messages: &[ChatMessage],
        tools: &[Value],
    ) -> Result<AiChatResult, String> {
        // 转换 tools: OpenAI format → Anthropic format
        let anthropic_tools: Vec<Value> = tools
            .iter()
            .map(|t| {
                let func = t.get("function").cloned().unwrap_or(json!({}));
                let name = func.get("name").cloned().unwrap_or(json!(""));
                let description = func.get("description").cloned().unwrap_or(json!(""));
                let parameters = func
                    .get("parameters")
                    .cloned()
                    .unwrap_or(json!({"type": "object", "properties": {}}));
                json!({"name": name, "description": description, "input_schema": parameters})
            })
            .collect();

        let system_text: String = messages
            .iter()
            .filter(|m| m.role == "system")
            .map(|m| match &m.content {
                ChatContent::Text(t) => t.clone(),
                _ => String::new(),
            })
            .collect::<Vec<_>>()
            .join("\n");

        let non_system: Vec<Value> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|m| {
                let role = if m.role == "assistant" {
                    "assistant"
                } else {
                    "user"
                };
                let text = match &m.content {
                    ChatContent::Text(t) => t.clone(),
                    _ => String::new(),
                };
                json!({"role": role, "content": [{"type": "text", "text": text}]})
            })
            .collect();

        let mut body = json!({
            "model": model,
            "max_tokens": 4096,
            "messages": non_system,
            "tools": anthropic_tools,
        });
        if !system_text.is_empty() {
            body["system"] = json!(system_text);
        }

        let text = {
            let mut last_err = String::new();
            let mut result_text: Option<String> = None;
            for attempt in 0..MAX_AI_RETRIES {
                match self.http
                    .post(format!("{base_url}/v1/messages"))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", api_key)
                    .header("anthropic-version", "2023-10-01")
                    .json(&body)
                    .send()
                    .await
                {
                    Err(e) => {
                        last_err = format!("Anthropic request failed: {e}");
                        if attempt < MAX_AI_RETRIES - 1 {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp.text().await
                            .map_err(|e| format!("Anthropic read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Anthropic API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                        return Err(last_err);
                    }
                }
            }
            result_text.ok_or(last_err)?
        };

        let parsed: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Anthropic response parse failed: {e}"))?;

        let usage = extract_usage(&parsed);

        let stop_reason = parsed
            .get("stop_reason")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if stop_reason == "tool_use" {
            let content_arr = parsed
                .get("content")
                .and_then(|c| c.as_array())
                .ok_or_else(|| "Anthropic: no content".to_string())?;

            // 提取伴随工具调用的 text blocks（模型的思考/解释内容）
            let assistant_text: String = content_arr
                .iter()
                .filter_map(|block| {
                    if block.get("type")?.as_str()? == "text" {
                        block.get("text")?.as_str().map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");

            let calls: Vec<AiToolCall> = content_arr
                .iter()
                .filter_map(|block| {
                    if block.get("type")?.as_str()? != "tool_use" {
                        return None;
                    }
                    let id = block.get("id")?.as_str()?.to_string();
                    let name = block.get("name")?.as_str()?.to_string();
                    let arguments = block.get("input")?.clone();
                    let raw = json!({
                        "id": &id,
                        "type": "function",
                        "function": {"name": &name, "arguments": arguments.to_string()}
                    });
                    Some(AiToolCall {
                        id,
                        name,
                        arguments,
                        raw,
                    })
                })
                .collect();
            Ok(AiChatResult::ToolCalls {
                text: assistant_text,
                calls,
                usage: usage.clone(),
            })
        } else {
            let text_out = parsed
                .get("content")
                .and_then(|c| c.as_array())
                .and_then(|arr| {
                    arr.iter()
                        .find(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                })
                .and_then(|b| b.get("text"))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            Ok(AiChatResult::Text(text_out, usage))
        }
    }

    /// Google Gemini API 适配器
    async fn chat_gemini(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<String, String> {
        let system_parts: Vec<String> = messages
            .iter()
            .filter(|m| m.role == "system")
            .map(|m| match &m.content {
                ChatContent::Text(t) => t.clone(),
                _ => String::new(),
            })
            .collect();

        let mut contents: Vec<Value> = Vec::new();
        if !system_parts.is_empty() {
            // Gemini 无 system role，注入为首条对话
            contents.push(json!({"role": "user", "parts": [{"text": system_parts.join("\n")}]}));
            contents.push(json!({"role": "model", "parts": [{"text": "Understood."}]}));
        }
        for m in messages.iter().filter(|m| m.role != "system") {
            let role = if m.role == "assistant" {
                "model"
            } else {
                "user"
            };
            let text = match &m.content {
                ChatContent::Text(t) => t.clone(),
                ChatContent::Parts(parts) => parts
                    .iter()
                    .filter_map(|p| {
                        if let ContentPart::Text { text } = p {
                            Some(text.clone())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n"),
            };
            contents.push(json!({"role": role, "parts": [{"text": text}]}));
        }

        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            base_url.trim_end_matches('/'),
            model,
            api_key
        );
        let body = json!({"contents": contents});

        let text = {
            let mut last_err = String::new();
            let mut result_text: Option<String> = None;
            for attempt in 0..MAX_AI_RETRIES {
                match self.http
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
                {
                    Err(e) => {
                        last_err = format!("Gemini request failed: {e}");
                        if attempt < MAX_AI_RETRIES - 1 {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp.text().await
                            .map_err(|e| format!("Gemini read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Gemini API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!("{}", format_retry_message(attempt, MAX_AI_RETRIES, &last_err));
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                        return Err(last_err);
                    }
                }
            }
            result_text.ok_or(last_err)?
        };

        let parsed: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Gemini response parse failed: {e}"))?;
        let content = parsed
            .get("candidates")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("content"))
            .and_then(|c| c.get("parts"))
            .and_then(|p| p.as_array())
            .and_then(|arr| arr.first())
            .and_then(|p| p.get("text"))
            .and_then(|t| t.as_str())
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
                ContentPart::Text {
                    text: text_prompt.to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl { url: data_url },
                },
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

/// 从 API 响应 JSON 中提取 token 使用量
/// 支持 OpenAI 格式 (`usage.prompt_tokens`) 和 Anthropic 格式 (`usage.input_tokens`)
fn extract_usage(parsed: &Value) -> TokenUsage {
    let usage = match parsed.get("usage") {
        Some(u) => u,
        None => return TokenUsage::default(),
    };
    // OpenAI: prompt_tokens / completion_tokens
    // Anthropic: input_tokens / output_tokens
    let prompt = usage
        .get("prompt_tokens")
        .or_else(|| usage.get("input_tokens"))
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    let completion = usage
        .get("completion_tokens")
        .or_else(|| usage.get("output_tokens"))
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    TokenUsage {
        prompt_tokens: prompt,
        completion_tokens: completion,
    }
}

/// 从 DeepSeek R1 响应中提取 `<think>...</think>` 思考过程
pub fn extract_deepseek_thinking(text: &str) -> (Option<String>, String) {
    if let (Some(start), Some(end)) = (text.find("<think>"), text.find("</think>")) {
        if end > start + 7 {
            let thinking = text[start + 7..end].trim().to_string();
            let response = text[end + 8..].trim().to_string();
            return (
                if thinking.is_empty() { None } else { Some(thinking) },
                response,
            );
        }
    }
    (None, text.to_string())
}

/// 从 Anthropic 响应中提取 thinking block
pub fn extract_anthropic_thinking(parsed: &Value) -> Option<String> {
    parsed
        .get("content")
        .and_then(|c| c.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|block| block.get("type").and_then(|t| t.as_str()) == Some("thinking"))
                .and_then(|block| block.get("thinking").and_then(|t| t.as_str()))
                .map(|s| s.to_string())
        })
}
