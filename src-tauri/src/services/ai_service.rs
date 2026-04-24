use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::app_preference_service::AiProviderConfig;
use super::model_image_service::split_data_url;

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
        Self {
            role: "tool".into(),
            content: ChatContent::Parts(vec![
                ContentPart::Text { text: text.into() },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: normalize_image_data_url(image_base64),
                    },
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

/// 流式 AI 增量事件（用于 SSE 解析）
pub enum AiChatDelta {
    TextDelta(String),
    ToolCallStart {
        index: usize,
        id: String,
        name: String,
    },
    ToolCallArgsDelta {
        index: usize,
        delta: String,
    },
    Usage(TokenUsage),
    Done {
        finish_reason: String,
    },
    Error(String),
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

fn normalize_image_data_url(image_base64: &str) -> String {
    if image_base64.starts_with("data:") {
        image_base64.to_string()
    } else {
        format!("data:image/png;base64,{image_base64}")
    }
}

fn chat_content_text(content: &ChatContent) -> String {
    match content {
        ChatContent::Text(text) => text.clone(),
        ChatContent::Parts(parts) => parts
            .iter()
            .filter_map(|part| match part {
                ContentPart::Text { text } => Some(text.clone()),
                ContentPart::ImageUrl { .. } => None,
            })
            .collect::<Vec<_>>()
            .join("\n"),
    }
}

fn anthropic_blocks_from_content(content: &ChatContent) -> Result<Vec<Value>, String> {
    match content {
        ChatContent::Text(text) => Ok(vec![json!({ "type": "text", "text": text })]),
        ChatContent::Parts(parts) => parts
            .iter()
            .map(anthropic_block_from_part)
            .collect::<Result<Vec<_>, _>>(),
    }
}

fn anthropic_block_from_part(part: &ContentPart) -> Result<Value, String> {
    match part {
        ContentPart::Text { text } => Ok(json!({ "type": "text", "text": text })),
        ContentPart::ImageUrl { image_url } => {
            let (mime_type, data) = split_data_url(&image_url.url)
                .ok_or_else(|| "anthropic image expects data url".to_string())?;
            Ok(json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": data,
                }
            }))
        }
    }
}

fn anthropic_tool_use_block(tool_call: &Value) -> Option<Value> {
    if tool_call.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
        return Some(tool_call.clone());
    }

    let id = tool_call.get("id")?.as_str()?;
    let function = tool_call.get("function")?;
    let name = function.get("name")?.as_str()?;
    let arguments = function.get("arguments")?.as_str().unwrap_or("{}");
    let input: Value = serde_json::from_str(arguments).unwrap_or_else(|_| json!({}));
    Some(json!({
        "type": "tool_use",
        "id": id,
        "name": name,
        "input": input,
    }))
}

fn anthropic_messages(messages: &[ChatMessage]) -> Result<(String, Vec<Value>), String> {
    let system_text = messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| chat_content_text(&message.content))
        .collect::<Vec<_>>()
        .join("\n");

    let mut non_system = Vec::new();
    for message in messages.iter().filter(|message| message.role != "system") {
        match message.role.as_str() {
            "assistant" => {
                let mut blocks = anthropic_blocks_from_content(&message.content)?;
                if let Some(tool_calls) = &message.tool_calls {
                    blocks.extend(tool_calls.iter().filter_map(anthropic_tool_use_block));
                }
                non_system.push(json!({
                    "role": "assistant",
                    "content": blocks,
                }));
            }
            "tool" => {
                let tool_use_id = message.tool_call_id.clone().unwrap_or_default();
                non_system.push(json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": anthropic_blocks_from_content(&message.content)?,
                    }],
                }));
            }
            _ => {
                non_system.push(json!({
                    "role": "user",
                    "content": anthropic_blocks_from_content(&message.content)?,
                }));
            }
        }
    }

    Ok((system_text, non_system))
}

fn gemini_parts_from_content(content: &ChatContent) -> Result<Vec<Value>, String> {
    match content {
        ChatContent::Text(text) => Ok(vec![json!({ "text": text })]),
        ChatContent::Parts(parts) => parts
            .iter()
            .map(|part| match part {
                ContentPart::Text { text } => Ok(json!({ "text": text })),
                ContentPart::ImageUrl { image_url } => {
                    let (mime_type, data) = split_data_url(&image_url.url)
                        .ok_or_else(|| "gemini image expects data url".to_string())?;
                    Ok(json!({
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": data,
                        }
                    }))
                }
            })
            .collect::<Result<Vec<_>, _>>(),
    }
}

/// 返回 (contents, system_instruction)。
/// system_instruction 对应 Gemini v1beta 的原生 systemInstruction 字段，
/// 避免把系统提示塞进 user/model fake 对话轮次影响 2.5 系模型输出。
fn gemini_contents(messages: &[ChatMessage]) -> Result<(Vec<Value>, Option<Value>), String> {
    let system_text = messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| chat_content_text(&message.content))
        .collect::<Vec<_>>()
        .join("\n");

    let system_instruction = if system_text.is_empty() {
        None
    } else {
        Some(json!({ "parts": [{ "text": system_text }] }))
    };

    let mut contents = Vec::new();
    for message in messages.iter().filter(|message| message.role != "system") {
        let role = if message.role == "assistant" {
            "model"
        } else {
            "user"
        };
        contents.push(json!({
            "role": role,
            "parts": gemini_parts_from_content(&message.content)?,
        }));
    }

    Ok((contents, system_instruction))
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
    format!(
        "AI request failed (attempt {}/{max}), retrying in {delay}s: {error}",
        attempt + 1
    )
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
                        eprintln!(
                            "{}",
                            format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                        );
                        tokio::time::sleep(retry_delay(attempt)).await;
                        continue;
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp
                        .text()
                        .await
                        .map_err(|e| format!("AI read body failed: {e}"))?;
                    if status.is_success() {
                        return Ok(text);
                    }
                    last_err = format!("AI API error {status}: {text}");
                    if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                        eprintln!(
                            "{}",
                            format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                        );
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
        let (system_text, non_system) = anthropic_messages(messages)?;

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
                match self
                    .http
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
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp
                            .text()
                            .await
                            .map_err(|e| format!("Anthropic read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Anthropic API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
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

        let (system_text, non_system) = anthropic_messages(messages)?;

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
                match self
                    .http
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
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp
                            .text()
                            .await
                            .map_err(|e| format!("Anthropic read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Anthropic API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
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
                    Some(AiToolCall {
                        id,
                        name,
                        arguments,
                        raw: block.clone(),
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
        let (contents, system_instruction) = gemini_contents(messages)?;

        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            base_url.trim_end_matches('/'),
            model,
            api_key
        );
        let mut body = json!({"contents": contents});
        if let Some(sys) = system_instruction {
            body["systemInstruction"] = sys;
        }

        let text = {
            let mut last_err = String::new();
            let mut result_text: Option<String> = None;
            for attempt in 0..MAX_AI_RETRIES {
                match self
                    .http
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
                {
                    Err(e) => {
                        last_err = format!("Gemini request failed: {e}");
                        if attempt < MAX_AI_RETRIES - 1 {
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
                            tokio::time::sleep(retry_delay(attempt)).await;
                            continue;
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let body_text = resp
                            .text()
                            .await
                            .map_err(|e| format!("Gemini read body failed: {e}"))?;
                        if status.is_success() {
                            result_text = Some(body_text);
                            break;
                        }
                        last_err = format!("Gemini API error {status}: {body_text}");
                        if attempt < MAX_AI_RETRIES - 1 && is_retryable_status(status.as_u16()) {
                            eprintln!(
                                "{}",
                                format_retry_message(attempt, MAX_AI_RETRIES, &last_err)
                            );
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

    /// 流式 chat，通过 channel 推送 AiChatDelta 增量事件。
    /// 调用方 recv().await 消费直到 Done 或 Error。
    pub fn chat_with_tools_stream(
        &self,
        config: &super::app_preference_service::AiProviderConfig,
        messages: Vec<ChatMessage>,
        tools: Vec<Value>,
    ) -> tokio::sync::mpsc::UnboundedReceiver<AiChatDelta> {
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        let provider = config.provider.clone().unwrap_or_else(|| "openai".into());
        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| default_base_url(&provider).to_string());
        let base_url = base_url.trim_end_matches('/').to_string();
        let api_key = config.api_key.clone().unwrap_or_default();
        let model = match provider.as_str() {
            "anthropic" => config
                .model
                .clone()
                .unwrap_or_else(|| "claude-opus-4-5".into()),
            "gemini" => config
                .model
                .clone()
                .unwrap_or_else(|| "gemini-2.0-flash".into()),
            _ => config.model.clone().unwrap_or_else(|| "gpt-4o".into()),
        };
        // 流式请求使用无响应 timeout 的 client（只设 connect timeout）
        let http = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(15))
            .build()
            .expect("Failed to build streaming HTTP client");
        tokio::spawn(async move {
            match provider.as_str() {
                "anthropic" => {
                    stream_anthropic(http, &base_url, &api_key, &model, messages, tools, tx).await
                }
                "gemini" => stream_gemini(http, &base_url, &api_key, &model, messages, tx).await,
                _ => {
                    stream_openai_like(http, &base_url, &api_key, &model, messages, tools, tx).await
                }
            }
        });
        rx
    }
}

/// 从变量中获取 base64 图片并构造 vision 消息内容
pub fn build_vision_content(text_prompt: &str, image_base64: Option<&str>) -> ChatContent {
    match image_base64 {
        None => ChatContent::Text(text_prompt.to_string()),
        Some(b64) => ChatContent::Parts(vec![
            ContentPart::Text {
                text: text_prompt.to_string(),
            },
            ContentPart::ImageUrl {
                image_url: ImageUrl {
                    url: normalize_image_data_url(b64),
                },
            },
        ]),
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
                if thinking.is_empty() {
                    None
                } else {
                    Some(thinking)
                },
                response,
            );
        }
    }
    (None, text.to_string())
}

// ─── 流式 provider 实现 ────────────────────────────────────────────────────

/// 解析单个 OpenAI 兼容 SSE data chunk，向 tx 推送 AiChatDelta
fn process_openai_sse_chunk(
    data: &str,
    tx: &tokio::sync::mpsc::UnboundedSender<AiChatDelta>,
) -> bool {
    // 返回 true 表示流已结束
    if data == "[DONE]" {
        return true;
    }
    let parsed: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return false,
    };
    let choices = match parsed.get("choices").and_then(|c| c.as_array()) {
        Some(c) => c,
        None => return false,
    };
    for choice in choices {
        let delta = match choice.get("delta") {
            Some(d) => d,
            None => continue,
        };
        // 文本增量
        if let Some(content) = delta.get("content").and_then(|v| v.as_str()) {
            if !content.is_empty() {
                let _ = tx.send(AiChatDelta::TextDelta(content.to_string()));
            }
        }
        // 工具调用增量
        if let Some(tcs) = delta.get("tool_calls").and_then(|v| v.as_array()) {
            for tc in tcs {
                let index = tc.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
                let id = tc
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let func = tc.get("function").cloned().unwrap_or(Value::Null);
                let name = func
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let args_delta = func
                    .get("arguments")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if !id.is_empty() && !name.is_empty() {
                    let _ = tx.send(AiChatDelta::ToolCallStart { index, id, name });
                }
                if !args_delta.is_empty() {
                    let _ = tx.send(AiChatDelta::ToolCallArgsDelta {
                        index,
                        delta: args_delta,
                    });
                }
            }
        }
        // finish_reason
        if let Some(fr) = choice.get("finish_reason").and_then(|v| v.as_str()) {
            if !fr.is_empty() {
                // 部分 API 在同一包里带 usage
                let usage = extract_usage(&parsed);
                if usage.prompt_tokens.is_some() || usage.completion_tokens.is_some() {
                    let _ = tx.send(AiChatDelta::Usage(usage));
                }
                let _ = tx.send(AiChatDelta::Done {
                    finish_reason: fr.to_string(),
                });
            }
        }
    }
    // usage 可能在单独一个无 choices 的末尾包中
    if choices.is_empty() {
        let usage = extract_usage(&parsed);
        if usage.prompt_tokens.is_some() || usage.completion_tokens.is_some() {
            let _ = tx.send(AiChatDelta::Usage(usage));
        }
    }
    false
}

/// 从 bytes_stream 中逐行解析 SSE，调用 on_data 处理每个 data: 行。
/// 返回 true 表示遇到终止信号（[DONE] 或流关闭）。
async fn drain_sse_stream<F>(
    mut stream: impl futures_util::Stream<Item = Result<bytes::Bytes, reqwest::Error>>
        + std::marker::Unpin,
    mut on_event: F,
) -> Result<(), String>
where
    F: FnMut(&str, Option<&str>) -> bool, // (data, event_type) -> stop?
{
    use futures_util::StreamExt;
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk: bytes::Bytes = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        let text = std::str::from_utf8(&chunk).unwrap_or("");
        buf.push_str(text);
        // 按 \n\n 分割事件块
        while let Some(pos) = buf.find("\n\n") {
            let block = buf[..pos].to_string();
            buf = buf[pos + 2..].to_string();
            let mut event_type: Option<&'static str> = None;
            let mut data_line: Option<String> = None;
            for line in block.lines() {
                if let Some(d) = line.strip_prefix("data: ") {
                    data_line = Some(d.to_string());
                } else if let Some(e) = line.strip_prefix("event: ") {
                    // 用 static str 化简 pattern matching（仅限已知类型）
                    event_type = match e.trim() {
                        "message_start" => Some("message_start"),
                        "content_block_start" => Some("content_block_start"),
                        "content_block_delta" => Some("content_block_delta"),
                        "content_block_stop" => Some("content_block_stop"),
                        "message_delta" => Some("message_delta"),
                        "message_stop" => Some("message_stop"),
                        _ => None,
                    };
                }
            }
            if let Some(data) = data_line {
                if on_event(&data, event_type) {
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}

/// OpenAI 兼容 SSE 流式实现（openai/openrouter/deepseek/groq/together/ollama）
async fn stream_openai_like(
    http: reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    tools: Vec<Value>,
    tx: tokio::sync::mpsc::UnboundedSender<AiChatDelta>,
) {
    let body = if !tools.is_empty() {
        json!({
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "stream": true,
            "stream_options": {"include_usage": true},
        })
    } else {
        json!({
            "model": model,
            "messages": messages,
            "stream": true,
            "stream_options": {"include_usage": true},
        })
    };
    let mut req = http
        .post(format!("{base_url}/chat/completions"))
        .header("Content-Type", "application/json")
        .json(&body);
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }
    let resp = match req.send().await {
        Err(e) => {
            let _ = tx.send(AiChatDelta::Error(format!("AI stream request failed: {e}")));
            return;
        }
        Ok(r) => r,
    };
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let _ = tx.send(AiChatDelta::Error(format!("AI API error {status}: {body}")));
        return;
    }
    let stream = resp.bytes_stream();
    let tx_clone = tx.clone();
    let result = drain_sse_stream(stream, |data, _event| {
        process_openai_sse_chunk(data, &tx_clone)
    })
    .await;
    if let Err(e) = result {
        let _ = tx.send(AiChatDelta::Error(e));
    }
}

/// Anthropic Messages API 流式实现
async fn stream_anthropic(
    http: reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    tools: Vec<Value>,
    tx: tokio::sync::mpsc::UnboundedSender<AiChatDelta>,
) {
    // 构建 Anthropic 格式 tools
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

    let (system_text, non_system) = match anthropic_messages(&messages) {
        Ok(parts) => parts,
        Err(error) => {
            let _ = tx.send(AiChatDelta::Error(error));
            return;
        }
    };

    let mut body = json!({
        "model": model,
        "max_tokens": 4096,
        "messages": non_system,
        "stream": true,
    });
    if !system_text.is_empty() {
        body["system"] = json!(system_text);
    }
    if !anthropic_tools.is_empty() {
        body["tools"] = json!(anthropic_tools);
    }

    let resp = match http
        .post(format!("{base_url}/v1/messages"))
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-10-01")
        .json(&body)
        .send()
        .await
    {
        Err(e) => {
            let _ = tx.send(AiChatDelta::Error(format!(
                "Anthropic stream request failed: {e}"
            )));
            return;
        }
        Ok(r) => r,
    };
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let _ = tx.send(AiChatDelta::Error(format!(
            "Anthropic API error {status}: {body}"
        )));
        return;
    }

    // 跟踪 content_block 类型：index -> "text" | "tool_use"
    let mut block_types: std::collections::HashMap<u64, String> = std::collections::HashMap::new();
    // tool_use blocks: index -> (id, name)
    let mut tool_starts: std::collections::HashMap<u64, (String, String)> =
        std::collections::HashMap::new();

    let stream = resp.bytes_stream();
    let tx_clone = tx.clone();
    let result = drain_sse_stream(stream, |data, event| {
        let parsed: Value = match serde_json::from_str(data) {
            Ok(v) => v,
            Err(_) => return false,
        };
        let ev = event.unwrap_or("");
        match ev {
            "content_block_start" => {
                let index = parsed.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                let block = parsed.get("content_block").cloned().unwrap_or(Value::Null);
                let btype = block
                    .get("type")
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .to_string();
                if btype == "tool_use" {
                    let id = block
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let name = block
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    tool_starts.insert(index, (id.clone(), name.clone()));
                    let _ = tx_clone.send(AiChatDelta::ToolCallStart {
                        index: index as usize,
                        id,
                        name,
                    });
                }
                block_types.insert(index, btype);
            }
            "content_block_delta" => {
                let index = parsed.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                let delta = parsed.get("delta").cloned().unwrap_or(Value::Null);
                let dtype = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                match dtype {
                    "text_delta" => {
                        if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                            if !text.is_empty() {
                                let _ = tx_clone.send(AiChatDelta::TextDelta(text.to_string()));
                            }
                        }
                    }
                    "input_json_delta" => {
                        if let Some(partial) = delta.get("partial_json").and_then(|v| v.as_str()) {
                            if !partial.is_empty() {
                                let _ = tx_clone.send(AiChatDelta::ToolCallArgsDelta {
                                    index: index as usize,
                                    delta: partial.to_string(),
                                });
                            }
                        }
                    }
                    _ => {}
                }
            }
            "message_delta" => {
                let delta = parsed.get("delta").cloned().unwrap_or(Value::Null);
                let stop_reason = delta
                    .get("stop_reason")
                    .and_then(|v| v.as_str())
                    .unwrap_or("end_turn");
                // 提取 usage
                if let Some(usage_val) = parsed.get("usage") {
                    let output_tokens = usage_val
                        .get("output_tokens")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32);
                    let _ = tx_clone.send(AiChatDelta::Usage(TokenUsage {
                        prompt_tokens: None,
                        completion_tokens: output_tokens,
                    }));
                }
                let finish_reason = if stop_reason == "tool_use" {
                    "tool_calls"
                } else {
                    "stop"
                };
                let _ = tx_clone.send(AiChatDelta::Done {
                    finish_reason: finish_reason.to_string(),
                });
                return true; // 流结束
            }
            "message_start" => {
                // 提取 input_tokens
                if let Some(usage_val) = parsed.get("message").and_then(|m| m.get("usage")) {
                    let input_tokens = usage_val
                        .get("input_tokens")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32);
                    let _ = tx_clone.send(AiChatDelta::Usage(TokenUsage {
                        prompt_tokens: input_tokens,
                        completion_tokens: None,
                    }));
                }
            }
            "message_stop" => return true,
            _ => {}
        }
        false
    })
    .await;

    if let Err(e) = result {
        let _ = tx.send(AiChatDelta::Error(e));
    }
}

/// Google Gemini SSE 流式实现（streamGenerateContent?alt=sse）
async fn stream_gemini(
    http: reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    tx: tokio::sync::mpsc::UnboundedSender<AiChatDelta>,
) {
    let (contents, system_instruction) = match gemini_contents(&messages) {
        Ok(v) => v,
        Err(error) => {
            let _ = tx.send(AiChatDelta::Error(error));
            return;
        }
    };

    let url = format!(
        "{}/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
        base_url.trim_end_matches('/'),
        model,
        api_key
    );
    let mut body = json!({"contents": contents});
    if let Some(sys) = system_instruction {
        body["systemInstruction"] = sys;
    }

    let resp = match http
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Err(e) => {
            let _ = tx.send(AiChatDelta::Error(format!(
                "Gemini stream request failed: {e}"
            )));
            return;
        }
        Ok(r) => r,
    };
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        crate::logger::warn("ai-chat", format!("Gemini stream HTTP {status}: {body}"));
        let _ = tx.send(AiChatDelta::Error(format!(
            "Gemini API error {status}: {body}"
        )));
        return;
    }

    let stream = resp.bytes_stream();
    let tx_clone = tx.clone();
    let mut last_usage = TokenUsage::default();
    let result = drain_sse_stream(stream, |data, _event| {
        let parsed: Value = match serde_json::from_str(data) {
            Ok(v) => v,
            Err(_) => return false,
        };
        // 提取文本片段
        if let Some(candidates) = parsed.get("candidates").and_then(|c| c.as_array()) {
            for candidate in candidates {
                if let Some(parts) = candidate
                    .get("content")
                    .and_then(|c| c.get("parts"))
                    .and_then(|p| p.as_array())
                {
                    for part in parts {
                        if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                            if !text.is_empty() {
                                let _ = tx_clone.send(AiChatDelta::TextDelta(text.to_string()));
                            }
                        }
                    }
                }
                // 检查 finishReason
                if let Some(reason) = candidate.get("finishReason").and_then(|v| v.as_str()) {
                    if !reason.is_empty() && reason != "FINISH_REASON_UNSPECIFIED" {
                        // 提取 usage（Gemini 在每个 chunk 末尾带 usageMetadata）
                        if let Some(meta) = parsed.get("usageMetadata") {
                            last_usage = TokenUsage {
                                prompt_tokens: meta
                                    .get("promptTokenCount")
                                    .and_then(|v| v.as_i64())
                                    .map(|v| v as i32),
                                completion_tokens: meta
                                    .get("candidatesTokenCount")
                                    .and_then(|v| v.as_i64())
                                    .map(|v| v as i32),
                            };
                        }
                        let _ = tx_clone.send(AiChatDelta::Usage(last_usage.clone()));
                        let _ = tx_clone.send(AiChatDelta::Done {
                            finish_reason: "stop".to_string(),
                        });
                        return true;
                    }
                }
            }
        }
        false
    })
    .await;

    if let Err(e) = result {
        let _ = tx.send(AiChatDelta::Error(e));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_vision_content_preserves_existing_data_url_mime() {
        let content = build_vision_content("look", Some("data:image/jpeg;base64,ZmFrZS1kYXRh"));

        let ChatContent::Parts(parts) = content else {
            panic!("expected parts");
        };
        assert!(matches!(
            &parts[1],
            ContentPart::ImageUrl { image_url }
                if image_url.url == "data:image/jpeg;base64,ZmFrZS1kYXRh"
        ));
    }

    #[test]
    fn anthropic_messages_emit_tool_result_with_image_blocks() {
        let assistant = ChatMessage {
            role: "assistant".into(),
            content: ChatContent::Text("calling tool".into()),
            tool_calls: Some(vec![json!({
                "id": "tool_1",
                "type": "function",
                "function": {
                    "name": "cdp_screenshot",
                    "arguments": "{\"format\":\"jpeg\"}"
                }
            })]),
            tool_call_id: None,
            name: None,
        };
        let tool = ChatMessage::tool_result_with_image(
            "tool_1",
            "/tmp/shot.jpg",
            "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
        );

        let (_system, messages) = anthropic_messages(&[assistant, tool]).expect("anthropic");

        assert_eq!(messages[0]["role"], "assistant");
        assert_eq!(messages[0]["content"][1]["type"], "tool_use");
        assert_eq!(messages[0]["content"][1]["id"], "tool_1");
        assert_eq!(messages[1]["role"], "user");
        assert_eq!(messages[1]["content"][0]["type"], "tool_result");
        assert_eq!(
            messages[1]["content"][0]["content"][1]["source"]["media_type"],
            "image/jpeg"
        );
    }

    #[test]
    fn gemini_contents_emit_inline_data_for_images() {
        let messages = vec![ChatMessage::with_content(
            "user",
            ChatContent::Parts(vec![
                ContentPart::Text {
                    text: "describe".into(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==".into(),
                    },
                },
            ]),
        )];

        let (contents, _system_instruction) = gemini_contents(&messages).expect("gemini");

        assert_eq!(contents[0]["role"], "user");
        assert_eq!(contents[0]["parts"][0]["text"], "describe");
        assert_eq!(
            contents[0]["parts"][1]["inlineData"]["mimeType"],
            "image/jpeg"
        );
    }
}
