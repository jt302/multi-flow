//! Dialog 工具 —— 通过 Tauri 事件 + oneshot 通道与前端 UI 弹窗交互
//!
//! 工作流程：
//! 1. 后端通过 `app.emit()` 发射 "ai-dialog-request" 事件
//! 2. 前端接收事件，展示弹窗
//! 3. 前端调用 Tauri command `submit_ai_dialog_response` 提交结果
//! 4. 后端 oneshot 通道接收结果，返回给 AI

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::oneshot;

use crate::state::AppState;

use super::{ToolContext, ToolResult};

// ─── 类型定义 ─────────────────────────────────────────────────────────

/// AI 弹窗请求（后端 → 前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDialogRequest {
    /// 唯一请求 ID，用于关联响应
    pub request_id: String,
    /// 弹窗类型
    pub dialog_type: String,
    /// 弹窗标题
    pub title: Option<String>,
    /// 消息内容
    pub message: String,
    /// 消息级别（info/warning/error/success）
    pub level: Option<String>,
    /// 输入框标签
    pub label: Option<String>,
    /// 输入框默认值
    pub default_value: Option<String>,
    /// 输入框占位符
    pub placeholder: Option<String>,
    /// 是否允许多选（文件对话框）
    pub multiple: Option<bool>,
    /// 文件类型过滤器
    pub filters: Option<Vec<DialogFileFilter>>,
    /// 默认文件名（保存对话框）
    pub default_name: Option<String>,
    /// 文件内容（保存对话框自动写入）
    pub content: Option<String>,
}

/// 文件类型过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogFileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// AI 弹窗响应（前端 → 后端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDialogResponse {
    pub request_id: String,
    /// 用户是否确认/提交（false = 取消）
    pub confirmed: bool,
    /// 用户输入值或选择的文件路径
    pub value: Option<String>,
}

// ─── 执行器 ──────────────────────────────────────────────────────────

/// 执行 dialog_* 类工具
pub async fn execute(name: &str, args: Value, ctx: &mut ToolContext<'_>) -> Result<ToolResult, String> {
    let dialog_type = name.strip_prefix("dialog_").unwrap_or(name);
    let request_id = format!("ai-dialog-{}-{}", ctx.run_id, uuid_v4_short());

    let request = AiDialogRequest {
        request_id: request_id.clone(),
        dialog_type: dialog_type.to_string(),
        title: opt_str(&args, "title"),
        message: opt_str(&args, "message").unwrap_or_default(),
        level: opt_str(&args, "level"),
        label: opt_str(&args, "label"),
        default_value: opt_str(&args, "default_value"),
        placeholder: opt_str(&args, "placeholder"),
        multiple: args.get("multiple").and_then(|v| v.as_bool()),
        filters: args.get("filters").and_then(|v| serde_json::from_value(v.clone()).ok()),
        default_name: opt_str(&args, "default_name"),
        content: opt_str(&args, "content"),
    };

    // 创建 oneshot 通道
    let (tx, rx) = oneshot::channel::<AiDialogResponse>();

    // 注册到 AppState
    {
        let state = ctx.app.state::<AppState>();
        let mut channels = state.ai_dialog_channels.lock()
            .map_err(|_| "ai_dialog_channels lock poisoned".to_string())?;
        channels.insert(request_id.clone(), tx);
    }

    // 发射事件到前端
    ctx.app.emit("ai-dialog-request", &request)
        .map_err(|e| format!("Failed to emit dialog event: {}", e))?;

    // 等待前端响应（带超时）
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(300), // 5 分钟超时
        rx,
    )
    .await
    .map_err(|_| "Dialog timed out (5 minutes)".to_string())?
    .map_err(|_| "Dialog channel closed unexpectedly".to_string())?;

    // 根据弹窗类型构造结果
    match dialog_type {
        "message" => {
            Ok(ToolResult::text("Message shown to user"))
        }
        "confirm" => {
            Ok(ToolResult::text(json!({
                "confirmed": response.confirmed,
            }).to_string()))
        }
        "input" => {
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "value": null
                }).to_string()))
            } else {
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "value": response.value
                }).to_string()))
            }
        }
        "save_file" => {
            if !response.confirmed || response.value.is_none() {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "path": null
                }).to_string()))
            } else {
                let path = response.value.unwrap();
                // 如果提供了 content，自动写入
                if let Some(content) = opt_str(&args, "content") {
                    std::fs::write(&path, &content)
                        .map_err(|e| format!("Failed to write file: {}", e))?;
                }
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "path": path
                }).to_string()))
            }
        }
        "open_file" | "select_folder" => {
            if !response.confirmed || response.value.is_none() {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "path": null
                }).to_string()))
            } else {
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "path": response.value
                }).to_string()))
            }
        }
        _ => Err(format!("Unknown dialog type: '{dialog_type}'")),
    }
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────

fn opt_str(args: &Value, key: &str) -> Option<String> {
    args.get(key).and_then(|v| v.as_str()).map(String::from)
}

/// 生成短 UUID（8字符）
fn uuid_v4_short() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:08x}", (ts & 0xFFFFFFFF) as u32)
}
