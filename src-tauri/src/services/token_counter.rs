//! Token 计数与上下文限制估算
//!
//! 使用字符计数近似估算 token 数（无外部依赖）。
//! 规则：英文每 4 字符 ≈ 1 token，中文每 2 字符 ≈ 1 token。

use crate::services::ai_service::{ChatContent, ChatMessage};

pub struct TokenCounter;

impl TokenCounter {
    /// 估算文本 token 数
    pub fn count_text(text: &str) -> usize {
        if text.is_empty() {
            return 0;
        }
        let mut count = 0usize;
        for ch in text.chars() {
            if ch.is_ascii() {
                count += 1; // 每 4 个 ascii 字符 ≈ 1 token
            } else {
                count += 2; // CJK 等宽字符大约 2 char ≈ 1 token（但每字符已算 2）
            }
        }
        // 粗略: ascii 按 4:1, 非 ascii 按 2:1
        // 上面累加的 count 需要除以 4 得到 token
        // 实际: 非 ascii 每字符已 ×2 ，所以总和 / 4 ≈ token
        (count + 3) / 4 // 向上取整
    }

    /// 估算单条消息 token 数（含 role overhead）
    pub fn count_message(msg: &ChatMessage) -> usize {
        let overhead = 4; // role + separators
        let content_tokens = match &msg.content {
            ChatContent::Text(t) => Self::count_text(t),
            ChatContent::Parts(parts) => {
                parts.iter().map(|p| match p {
                    crate::services::ai_service::ContentPart::Text { text } => Self::count_text(text),
                    crate::services::ai_service::ContentPart::ImageUrl { .. } => 85, // 图片 token 固定估算
                }).sum()
            }
        };
        let tool_calls_tokens = msg.tool_calls.as_ref().map(|calls| {
            let json = serde_json::to_string(calls).unwrap_or_default();
            Self::count_text(&json)
        }).unwrap_or(0);

        overhead + content_tokens + tool_calls_tokens
    }

    /// 估算消息列表总 token 数
    pub fn count_messages(messages: &[ChatMessage]) -> usize {
        messages.iter().map(Self::count_message).sum::<usize>() + 3 // 基础 overhead
    }

    /// 估算工具定义 token 数
    pub fn count_tools(tools: &[serde_json::Value]) -> usize {
        let json = serde_json::to_string(tools).unwrap_or_default();
        Self::count_text(&json)
    }

    /// 获取模型上下文窗口大小（token 数）
    pub fn context_limit(provider: &str, model: &str) -> usize {
        let p = provider.to_lowercase();
        let m = model.to_lowercase();

        if p.contains("anthropic") || m.contains("claude") {
            return 200_000;
        }
        if p.contains("google") || m.contains("gemini") {
            if m.contains("2.5") || m.contains("pro") {
                return 1_000_000;
            }
            return 1_000_000;
        }
        if m.contains("deepseek") {
            if m.contains("r1") { return 128_000; }
            return 64_000;
        }
        if m.contains("gpt-4.1") || m.contains("gpt-4-1") {
            return 1_000_000;
        }
        if m.contains("gpt-4o") || m.contains("gpt-4-o") {
            return 128_000;
        }
        if m.contains("o3") || m.contains("o4") {
            return 200_000;
        }
        if p.contains("groq") || p.contains("together") {
            return 32_000;
        }
        if p.contains("ollama") {
            return 8_000;
        }
        // 默认保守估计
        128_000
    }
}

/// 截断工具结果文本到指定长度
pub fn truncate_tool_result(text: &str, category: &str) -> String {
    let max_chars = match category {
        "cdp" => 4_000,     // 页面文本可能很长
        "file" => 8_000,    // 文件内容
        "app" => 2_000,     // 应用数据
        _ => 4_000,
    };

    if text.len() <= max_chars {
        return text.to_string();
    }

    let truncated = &text[..text.floor_char_boundary(max_chars)];
    format!("{truncated}\n... [truncated, {total} chars total]", total = text.len())
}
