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
    /// 是否允许多选（文件对话框 / select 弹窗）
    pub multiple: Option<bool>,
    /// 文件类型过滤器
    pub filters: Option<Vec<DialogFileFilter>>,
    /// 默认文件名（保存对话框）
    pub default_name: Option<String>,
    /// 文件内容（保存对话框自动写入 / markdown 弹窗内容）
    pub content: Option<String>,

    // ── 扩展字段（新增弹窗类型使用） ─────────────────────────────────────

    /// select 弹窗选项列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<DialogSelectOption>>,
    /// 多选时最大选择数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_select: Option<u32>,
    /// form 弹窗字段列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<DialogFormField>>,
    /// 提交按钮文字
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submit_label: Option<String>,
    /// table 弹窗列定义
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<Vec<DialogTableColumn>>,
    /// table 弹窗行数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<Value>>,
    /// 是否可选择行
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selectable: Option<bool>,
    /// 表格最大高度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_height: Option<u32>,
    /// 图片数据（base64 或文件路径）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    /// 图片格式
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_format: Option<String>,
    /// 输入框占位符（image 弹窗）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_placeholder: Option<String>,
    /// 自定义操作按钮
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actions: Option<Vec<DialogAction>>,
    /// countdown 弹窗秒数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seconds: Option<u32>,
    /// countdown 操作按钮文字
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_label: Option<String>,
    /// countdown 是否自动执行
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_proceed: Option<bool>,
    /// toast 持续时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// toast 是否持久显示
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistent: Option<bool>,
    /// markdown 弹窗宽度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<String>,
    /// 是否可复制
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copyable: Option<bool>,
}

/// select 弹窗选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogSelectOption {
    pub label: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// form 弹窗字段
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogFormField {
    pub name: String,
    pub label: String,
    #[serde(default = "default_field_type")]
    pub field_type: String,
    #[serde(default)]
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<DialogSelectOption>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

fn default_field_type() -> String { "text".to_string() }

/// table 弹窗列定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogTableColumn {
    pub key: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
}

/// 自定义操作按钮
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogAction {
    pub label: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
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
        multiple: args.get("multiple").and_then(|v| v.as_bool())
            .or_else(|| args.get("multi_select").and_then(|v| v.as_bool())),
        filters: args.get("filters").and_then(|v| serde_json::from_value(v.clone()).ok()),
        default_name: opt_str(&args, "default_name"),
        content: opt_str(&args, "content"),
        // 扩展字段
        options: args.get("options").and_then(|v| serde_json::from_value(v.clone()).ok()),
        max_select: args.get("max_select").and_then(|v| v.as_u64()).map(|v| v as u32),
        fields: args.get("fields").and_then(|v| serde_json::from_value(v.clone()).ok()),
        submit_label: opt_str(&args, "submit_label"),
        columns: args.get("columns").and_then(|v| serde_json::from_value(v.clone()).ok()),
        rows: args.get("rows").and_then(|v| v.as_array().cloned()),
        selectable: args.get("selectable").and_then(|v| v.as_bool()),
        max_height: args.get("max_height").and_then(|v| v.as_u64()).map(|v| v as u32),
        image: opt_str(&args, "image"),
        image_format: opt_str(&args, "image_format"),
        input_placeholder: opt_str(&args, "input_placeholder"),
        actions: args.get("actions").and_then(|v| serde_json::from_value(v.clone()).ok()),
        seconds: args.get("seconds").and_then(|v| v.as_u64()).map(|v| v as u32),
        action_label: opt_str(&args, "action_label"),
        auto_proceed: args.get("auto_proceed").and_then(|v| v.as_bool()),
        duration_ms: args.get("duration_ms").and_then(|v| v.as_u64()),
        persistent: args.get("persistent").and_then(|v| v.as_bool()),
        width: opt_str(&args, "width"),
        copyable: args.get("copyable").and_then(|v| v.as_bool()),
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
        "confirm" | "countdown" => {
            Ok(ToolResult::text(json!({
                "cancelled": !response.confirmed,
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
        "select" => {
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "selected": null
                }).to_string()))
            } else {
                // value 可能是 JSON 数组（多选）或单个字符串
                let selected = response.value.as_deref()
                    .and_then(|v| serde_json::from_str::<Value>(v).ok())
                    .unwrap_or_else(|| json!(response.value));
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "selected": selected
                }).to_string()))
            }
        }
        "form" => {
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "values": null
                }).to_string()))
            } else {
                // value 是 JSON 对象字符串
                let values = response.value.as_deref()
                    .and_then(|v| serde_json::from_str::<Value>(v).ok())
                    .unwrap_or(json!({}));
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "values": values
                }).to_string()))
            }
        }
        "table" => {
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "confirmed": false,
                    "selected_indices": null
                }).to_string()))
            } else {
                let indices = response.value.as_deref()
                    .and_then(|v| serde_json::from_str::<Value>(v).ok());
                Ok(ToolResult::text(json!({
                    "confirmed": true,
                    "selected_indices": indices
                }).to_string()))
            }
        }
        "image" => {
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "cancelled": true,
                    "value": null,
                    "action": null
                }).to_string()))
            } else {
                // value 格式: JSON { "value": "...", "action": "..." }
                let parsed = response.value.as_deref()
                    .and_then(|v| serde_json::from_str::<Value>(v).ok())
                    .unwrap_or(json!({}));
                Ok(ToolResult::text(json!({
                    "cancelled": false,
                    "value": parsed.get("value").and_then(|v| v.as_str()),
                    "action": parsed.get("action").and_then(|v| v.as_str()).unwrap_or("confirm")
                }).to_string()))
            }
        }
        "toast" => {
            // toast 无 actions 时不阻塞，但实际上仍走 oneshot channel
            if !response.confirmed {
                Ok(ToolResult::text(json!({
                    "dismissed": true,
                    "action": null
                }).to_string()))
            } else {
                Ok(ToolResult::text(json!({
                    "dismissed": false,
                    "action": response.value
                }).to_string()))
            }
        }
        "markdown" => {
            let action = response.value.unwrap_or_else(|| "close".to_string());
            Ok(ToolResult::text(json!({
                "action": action
            }).to_string()))
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
