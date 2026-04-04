//! AI 工具注册表 —— 类 MCP 的可插拔工具系统
//!
//! 为 AI Agent 提供统一的工具发现与执行接口。
//! 所有工具按类别拆分（CDP / Magic / App / File / Dialog / Utility），
//! 通过 `ToolRegistry` 统一注册、按前缀路由分发执行。

pub mod tool_defs;
pub mod app_tools;
pub mod file_tools;
pub mod dialog_tools;

use std::collections::HashMap;
use serde_json::Value;
use tauri::AppHandle;

use crate::models::ScriptStep;
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::models::RunLogEntry;

// ─── 核心类型 ─────────────────────────────────────────────────────────────

/// 工具执行上下文，包含当前运行态的所有依赖
pub struct ToolContext<'a> {
    pub cdp: Option<&'a CdpClient>,
    pub http_client: &'a reqwest::Client,
    pub magic_port: Option<u16>,
    pub app: &'a AppHandle,
    pub run_id: &'a str,
    pub step_index: usize,
    pub vars: &'a RunVariables,
    pub logs: &'a mut Vec<RunLogEntry>,
    /// 脚本级 AI 配置（用于嵌套 AI 调用）
    pub script_ai_config: Option<&'a crate::services::app_preference_service::AiProviderConfig>,
}

/// 工具执行结果
pub struct ToolResult {
    /// 文本输出（返回给 AI 的主要内容）
    pub text: Option<String>,
    /// 图片 base64（截图工具专用，用于视觉注入到 AI 对话历史）
    pub image_base64: Option<String>,
    /// 输出变量映射（key → value）
    pub vars: HashMap<String, String>,
}

impl ToolResult {
    pub fn empty() -> Self {
        Self { text: None, image_base64: None, vars: HashMap::new() }
    }

    pub fn text(s: impl Into<String>) -> Self {
        Self { text: Some(s.into()), image_base64: None, vars: HashMap::new() }
    }

    pub fn with_vars(text: Option<String>, vars: HashMap<String, String>) -> Self {
        Self { text, image_base64: None, vars }
    }

    pub fn with_image(text: Option<String>, image_base64: String, vars: HashMap<String, String>) -> Self {
        Self { text, image_base64: Some(image_base64), vars }
    }
}

// ─── 工具注册表 ──────────────────────────────────────────────────────────

/// 可用工具类别筛选
#[derive(Debug, Clone, Default)]
pub struct ToolFilter {
    /// 启用的工具类别（空 = 全部启用）
    pub categories: Vec<String>,
}

impl ToolFilter {
    pub fn all() -> Self {
        Self { categories: vec![] }
    }

    pub fn with_categories(categories: Vec<String>) -> Self {
        Self { categories }
    }

    fn is_allowed(&self, tool_name: &str) -> bool {
        if self.categories.is_empty() {
            return true;
        }
        let category = tool_category(tool_name);
        self.categories.iter().any(|c| c == category)
    }
}

/// 根据工具名前缀返回类别
fn tool_category(name: &str) -> &str {
    if name.starts_with("cdp_") || name == "cdp" { return "cdp"; }
    if name.starts_with("magic_") { return "magic"; }
    if name.starts_with("app_") { return "app"; }
    if name.starts_with("file_") { return "file"; }
    if name.starts_with("dialog_") { return "dialog"; }
    if name.starts_with("captcha_") { return "captcha"; }
    "utility"
}

/// AI 工具注册表
pub struct ToolRegistry;

impl ToolRegistry {
    /// 获取所有工具的 OpenAI function schema（JSON），可按类别筛选
    pub fn definitions(filter: &ToolFilter) -> Vec<Value> {
        tool_defs::all_tool_definitions()
            .into_iter()
            .filter(|def| {
                let name = def
                    .get("function")
                    .and_then(|f| f.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("");
                filter.is_allowed(name)
            })
            .collect()
    }

    /// 执行指定工具，返回 ToolResult
    ///
    /// 分发策略：
    /// - cdp_* / magic_* / wait / print / utility → 构造 ScriptStep 委托 execute_step
    /// - app_* → app_tools 模块直接调用 Service
    /// - file_* → file_tools 模块直接调用 std::fs
    /// - dialog_* → dialog_tools 模块通过 Tauri 事件与前端通信
    pub async fn execute(
        name: &str,
        args: Value,
        ctx: &mut ToolContext<'_>,
    ) -> Result<ToolResult, String> {
        let category = tool_category(name);

        match category {
            "cdp" | "magic" | "utility" | "captcha" => {
                Self::execute_via_script_step(name, args, ctx).await
            }
            "app" => {
                app_tools::execute(name, args, ctx).await
            }
            "file" => {
                file_tools::execute(name, args, ctx).await
            }
            "dialog" => {
                dialog_tools::execute(name, args, ctx).await
            }
            _ => Err(format!("Unknown tool category for '{name}'")),
        }
    }

    /// 通过构造 ScriptStep 委托给已有的 execute_step 执行
    /// CDP / Magic / Utility 工具全部走这条路径
    async fn execute_via_script_step(
        name: &str,
        args: Value,
        ctx: &mut ToolContext<'_>,
    ) -> Result<ToolResult, String> {
        // 注入 kind 字段，构造完整的 ScriptStep JSON
        let mut step_json = args;
        if let Some(obj) = step_json.as_object_mut() {
            obj.insert("kind".to_string(), serde_json::Value::String(name.to_string()));
        }

        let inner_step: ScriptStep = serde_json::from_value(step_json)
            .map_err(|e| format!("Tool '{name}' args parse error: {e}"))?;

        // 调用 execute_step（需要从 automation_commands 中导出）
        let (output, step_vars) = Box::pin(crate::commands::automation_commands::execute_step(
            ctx.cdp,
            ctx.http_client,
            ctx.magic_port,
            &inner_step,
            ctx.vars,
            ctx.app,
            ctx.run_id,
            ctx.step_index,
            ctx.script_ai_config,
            ctx.logs,
        ))
        .await?;

        // 检查是否为截图工具：返回包含图片的 ToolResult
        let is_screenshot_tool = matches!(
            name,
            "cdp_screenshot" | "magic_capture_app_shell" | "screenshot"
        );

        if is_screenshot_tool {
            // 尝试读取截图文件并转为 base64
            if let Some(ref file_path) = output {
                if let Ok(bytes) = std::fs::read(file_path) {
                    let b64 = base64_encode(&bytes);
                    return Ok(ToolResult::with_image(output, b64, step_vars));
                }
            }
        }

        Ok(ToolResult::with_vars(output, step_vars))
    }
}

/// base64 编码辅助
fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}
