use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::app_preference_service::AiProviderConfig;

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
        Self { role: "user".into(), content: ChatContent::Text(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system".into(), content: ChatContent::Text(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: "assistant".into(), content: ChatContent::Text(content.into()), tool_calls: None, tool_call_id: None, name: None }
    }
    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self { role: "tool".into(), content: ChatContent::Text(content.into()), tool_calls: None, tool_call_id: Some(tool_call_id.into()), name: None }
    }
    pub fn with_content(role: impl Into<String>, content: ChatContent) -> Self {
        Self { role: role.into(), content, tool_calls: None, tool_call_id: None, name: None }
    }
}

/// AI 工具调用结果
pub enum AiChatResult {
    /// 模型返回文本（无 tool_calls）
    Text(String),
    /// 模型请求调用工具
    ToolCalls(Vec<AiToolCall>),
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

        let resp_text = self.post_chat(base_url, api_key, &body).await?;
        let parsed: Value = serde_json::from_str(&resp_text)
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

    /// 支持 tool_calls 的 chat，返回文本或工具调用列表
    pub async fn chat_with_tools(
        &self,
        config: &AiProviderConfig,
        messages: &[ChatMessage],
        tools: &[Value],
    ) -> Result<AiChatResult, String> {
        let base_url = config.base_url.as_deref()
            .unwrap_or("https://api.openai.com/v1")
            .trim_end_matches('/');
        let api_key = config.api_key.as_deref().unwrap_or("");
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

        let choice = parsed
            .get("choices").and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .ok_or_else(|| "AI response: no choices".to_string())?;

        let finish_reason = choice.get("finish_reason").and_then(|v| v.as_str()).unwrap_or("");
        let message = choice.get("message").ok_or_else(|| "AI response: no message".to_string())?;

        if finish_reason == "tool_calls" {
            let calls_raw = message.get("tool_calls")
                .and_then(|v| v.as_array())
                .ok_or_else(|| "AI response: finish_reason=tool_calls but no tool_calls array".to_string())?;

            let calls = calls_raw.iter().filter_map(|tc| {
                let id = tc.get("id")?.as_str()?.to_string();
                let func = tc.get("function")?;
                let name = func.get("name")?.as_str()?.to_string();
                let args_str = func.get("arguments")?.as_str().unwrap_or("{}");
                let arguments: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                Some(AiToolCall { id, name, arguments, raw: tc.clone() })
            }).collect::<Vec<_>>();

            Ok(AiChatResult::ToolCalls(calls))
        } else {
            let content = message.get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Ok(AiChatResult::Text(content))
        }
    }

    async fn post_chat(&self, base_url: &str, api_key: &str, body: &Value) -> Result<String, String> {
        let mut req = self.http
            .post(format!("{base_url}/chat/completions"))
            .header("Content-Type", "application/json")
            .json(body);
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
        Ok(text)
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

/// 构建 AI Agent 可用的工具列表（常用步骤作为 OpenAI function definitions）
pub fn build_agent_tools() -> Vec<Value> {
    vec![
        tool("wait", "等待指定毫秒数", json!({
            "type": "object",
            "properties": { "ms": { "type": "integer", "description": "等待时长（毫秒）" } },
            "required": ["ms"]
        })),
        tool("cdp_navigate", "导航到指定 URL", json!({
            "type": "object",
            "properties": {
                "url": { "type": "string", "description": "目标 URL" },
                "output_key": { "type": "string", "description": "将 URL 存入此变量名" }
            },
            "required": ["url"]
        })),
        tool("cdp_reload", "重新加载当前页面", json!({
            "type": "object",
            "properties": {
                "ignore_cache": { "type": "boolean", "description": "是否忽略缓存" }
            }
        })),
        tool("cdp_evaluate", "在页面执行 JavaScript 并获取返回值", json!({
            "type": "object",
            "properties": {
                "expression": { "type": "string", "description": "JavaScript 表达式" },
                "output_key": { "type": "string", "description": "将返回值存入此变量名" }
            },
            "required": ["expression"]
        })),
        tool("cdp_click", "点击页面元素", json!({
            "type": "object",
            "properties": {
                "selector": { "type": "string", "description": "元素选择器（CSS/XPath/文本内容，类型由 selector_type 决定）" },
                "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" }
            },
            "required": ["selector"]
        })),
        tool("cdp_type", "向元素输入文本", json!({
            "type": "object",
            "properties": {
                "selector": { "type": "string", "description": "元素选择器（CSS/XPath/文本内容）" },
                "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                "text": { "type": "string", "description": "要输入的文本" }
            },
            "required": ["selector", "text"]
        })),
        tool("cdp_get_text", "获取元素的文本内容", json!({
            "type": "object",
            "properties": {
                "selector": { "type": "string", "description": "元素选择器（CSS/XPath/文本内容）" },
                "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                "output_key": { "type": "string", "description": "将文本存入此变量名" }
            },
            "required": ["selector"]
        })),
        tool("cdp_wait_for_selector", "等待元素出现在 DOM 中", json!({
            "type": "object",
            "properties": {
                "selector": { "type": "string", "description": "元素选择器（CSS/XPath/文本内容）" },
                "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                "timeout_ms": { "type": "integer", "description": "超时毫秒数（默认 10000）" }
            },
            "required": ["selector"]
        })),
        tool("cdp_scroll_to", "滚动页面到指定元素或坐标", json!({
            "type": "object",
            "properties": {
                "selector": { "type": "string", "description": "元素选择器（CSS/XPath/文本内容，可选）" },
                "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                "x": { "type": "number", "description": "横向坐标" },
                "y": { "type": "number", "description": "纵向坐标" }
            }
        })),
        tool("cdp_screenshot", "截取当前页面截图", json!({
            "type": "object",
            "properties": {
                "format": { "type": "string", "enum": ["png", "jpeg"], "description": "图片格式" },
                "output_key_base64": { "type": "string", "description": "将 base64 截图存入此变量名" },
                "output_path": { "type": "string", "description": "保存到磁盘的绝对路径" }
            }
        })),
        tool("wait_for_user", "暂停执行，等待人工操作或输入", json!({
            "type": "object",
            "properties": {
                "message": { "type": "string", "description": "展示给用户的消息" },
                "input_label": { "type": "string", "description": "输入框标签（不填则无输入框）" },
                "output_key": { "type": "string", "description": "将用户输入存入此变量名" },
                "timeout_ms": { "type": "integer", "description": "超时毫秒数（不填则无超时）" }
            },
            "required": ["message"]
        })),
        tool("magic_get_browsers", "获取所有浏览器实例列表", json!({
            "type": "object",
            "properties": {
                "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
            }
        })),
        tool("magic_open_new_tab", "打开新标签页", json!({
            "type": "object",
            "properties": {
                "url": { "type": "string", "description": "要打开的 URL" },
                "browser_id": { "type": "integer", "description": "目标浏览器 ID（可选）" },
                "output_key": { "type": "string", "description": "将新标签页 ID 存入此变量名" }
            },
            "required": ["url"]
        })),
    ]
}

fn tool(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters
        }
    })
}
