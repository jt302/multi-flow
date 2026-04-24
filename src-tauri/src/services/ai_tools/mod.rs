//! AI 工具注册表 —— 类 MCP 的可插拔工具系统
//!
//! 为 AI Agent 提供统一的工具发现与执行接口。
//! 所有工具按类别拆分（CDP / Magic / App / Auto / File / Dialog / Utility），
//! 通过 `ToolRegistry` 统一注册、按前缀路由分发执行。

pub mod app_tools;
pub mod auto_tools;
pub mod dialog_tools;
pub mod exec_tools;
pub mod file_tools;
pub mod skill_tools;
pub mod tool_defs;

use serde_json::Value;
use std::collections::HashMap;
use std::sync::LazyLock;
use tauri::{AppHandle, Emitter, Manager};

use crate::models::RunLogEntry;
use crate::models::ScriptStep;
use crate::services::automation_cdp_client::CdpClient;
use crate::services::automation_interpolation::RunVariables;
use crate::services::model_image_service::prepare_image_for_model_from_bytes;

// ─── 核心类型 ─────────────────────────────────────────────────────────────

/// 工具执行上下文，包含当前运行态的所有依赖
pub struct ToolContext<'a> {
    pub cdp: Option<&'a CdpClient>,
    pub http_client: &'a reqwest::Client,
    pub magic_port: Option<u16>,
    pub current_profile_id: Option<&'a str>,
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
    pub fn text(s: impl Into<String>) -> Self {
        Self {
            text: Some(s.into()),
            image_base64: None,
            vars: HashMap::new(),
        }
    }

    pub fn with_vars(text: Option<String>, vars: HashMap<String, String>) -> Self {
        Self {
            text,
            image_base64: None,
            vars,
        }
    }

    pub fn with_image(
        text: Option<String>,
        image_base64: String,
        vars: HashMap<String, String>,
    ) -> Self {
        Self {
            text,
            image_base64: Some(image_base64),
            vars,
        }
    }
}

// ─── 工具注册表 ──────────────────────────────────────────────────────────

/// 可用工具类别筛选
#[derive(Debug, Clone, Default)]
pub struct ToolFilter {
    /// 启用的工具类别（空 = 全部启用）
    pub categories: Vec<String>,
    /// 排除的工具类别（优先于 categories）
    pub excluded_categories: Vec<String>,
    /// 精确工具名白名单（非空时只允许列出的工具通过，用于 skill allowed_tools 约束）
    pub allowed_names: Vec<String>,
}

impl ToolFilter {
    pub fn all() -> Self {
        Self {
            categories: vec![],
            excluded_categories: vec![],
            allowed_names: vec![],
        }
    }

    pub fn with_categories(categories: Vec<String>) -> Self {
        Self {
            categories,
            excluded_categories: vec![],
            allowed_names: vec![],
        }
    }

    /// 排除指定类别的工具（链式调用）
    pub fn exclude(mut self, categories: Vec<String>) -> Self {
        self.excluded_categories = categories;
        self
    }

    fn is_allowed(&self, tool_name: &str) -> bool {
        let category = tool_category(tool_name);
        // excluded_categories 最高优先级
        if self.excluded_categories.iter().any(|c| c == category) {
            return false;
        }
        // skill allowed_names 约束（若非空，则工具名必须在列表内）
        if !self.allowed_names.is_empty() && !self.allowed_names.iter().any(|n| n == tool_name) {
            return false;
        }
        // 类别白名单
        if self.categories.is_empty() {
            return true;
        }
        self.categories.iter().any(|c| c == category)
    }
}

/// 根据工具名前缀返回类别
pub fn tool_category(name: &str) -> &str {
    if name.starts_with("cdp_") || name == "cdp" {
        return "cdp";
    }
    if name.starts_with("magic_") {
        return "magic";
    }
    if name.starts_with("auto_") {
        return "auto";
    }
    if name.starts_with("app_") {
        return "app";
    }
    if name.starts_with("file_") {
        return "file";
    }
    if name.starts_with("skill_") {
        return "skill";
    }
    if name.starts_with("dialog_") {
        return "dialog";
    }
    if name == "exec_command" {
        return "utility";
    }
    if name.starts_with("captcha_") {
        return "captcha";
    }
    "utility"
}

/// 工具风险等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ToolRiskLevel {
    /// 只读操作：get_text, screenshot, get_tabs 等
    Safe,
    /// 交互操作：click, type, navigate 等
    Moderate,
    /// 破坏性操作：delete, close, write 等
    Dangerous,
}

/// 根据工具名返回风险等级
pub fn tool_risk_level(tool_name: &str) -> ToolRiskLevel {
    match tool_name {
        // 危险工具 —— 破坏性操作
        "app_delete_profile" | "app_delete_proxy" | "app_delete_group" | "app_stop_profile"
        | "app_update_device_preset" | "app_delete_device_preset" | "magic_set_closed"
        | "magic_safe_quit" | "file_write" | "file_append" | "file_mkdir"
        | "file_str_replace" | "file_write_folder_desc" | "cdp_clear_storage"
        | "cdp_delete_cookies" | "auto_delete_script"
        | "skill_create" | "skill_update" | "skill_delete" | "skill_install" => {
            ToolRiskLevel::Dangerous
        }

        // 安全工具 —— 只读操作
        name if name.starts_with("app_list_")
            || name.starts_with("app_get_")
            || name.starts_with("magic_get_")
            || name.starts_with("cdp_get_")
            || name == "cdp_screenshot"
            || name == "cdp_get_document"
            || name == "cdp_get_full_ax_tree"
            || name.starts_with("file_read")
            || name == "file_exists"
            || name == "file_list_dir"
            || name.starts_with("auto_list_")
            || name == "skill_list"
            || name == "skill_read"
            || name.starts_with("auto_get_")
            || name == "print"
            || name == "submit_result" =>
        {
            ToolRiskLevel::Safe
        }

        "exec_command" => ToolRiskLevel::Moderate,

        // 其余为中等风险
        _ => ToolRiskLevel::Moderate,
    }
}

/// 判断工具是否属于高风险/破坏性操作
fn is_dangerous_tool(name: &str) -> bool {
    tool_risk_level(name) == ToolRiskLevel::Dangerous
}

/// 返回所有危险工具名称列表
pub fn all_dangerous_tool_names() -> Vec<&'static str> {
    vec![
        "app_delete_profile",
        "app_delete_proxy",
        "app_delete_group",
        "app_stop_profile",
        "app_update_device_preset",
        "app_delete_device_preset",
        "magic_set_closed",
        "magic_safe_quit",
        "file_write",
        "file_append",
        "file_mkdir",
        "file_str_replace",
        "file_write_folder_desc",
        "cdp_clear_storage",
        "cdp_delete_cookies",
        "auto_delete_script",
        "skill_create",
        "skill_update",
        "skill_delete",
        "skill_install",
    ]
}

/// 缓存的完整工具定义列表（LazyLock，只构建一次）
static ALL_TOOL_DEFS: LazyLock<Vec<Value>> = LazyLock::new(tool_defs::all_tool_definitions);

/// AI 工具注册表
pub struct ToolRegistry;

impl ToolRegistry {
    /// 获取所有工具的 OpenAI function schema（JSON），可按类别筛选
    pub fn definitions(filter: &ToolFilter) -> Vec<Value> {
        ALL_TOOL_DEFS
            .iter()
            .filter(|def| {
                let name = def
                    .get("function")
                    .and_then(|f| f.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("");
                filter.is_allowed(name)
            })
            .cloned()
            .collect()
    }

    /// 执行指定工具，返回 ToolResult
    ///
    /// 分发策略：
    /// - cdp_* / magic_* / wait / print / utility → 构造 ScriptStep 委托 execute_step
    /// - app_* → app_tools 模块直接调用 Service
    /// - file_* → file_tools 模块直接调用 std::fs（限制在 appData/fs）
    /// - dialog_* → dialog_tools 模块通过 Tauri 事件与前端通信
    pub async fn execute(
        name: &str,
        args: Value,
        ctx: &mut ToolContext<'_>,
    ) -> Result<ToolResult, String> {
        // load_skill 是元工具（始终安全，绕过危险工具检查和类别路由）
        if name == "load_skill" {
            let slug = args
                .get("slug")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: 'slug'".to_string())?;
            let svc = crate::services::ai_skill_service::from_app(ctx.app)
                .map_err(|e| format!("Skill service error: {e}"))?;
            return match svc.read_skill(slug) {
                Ok(full) if full.meta.enabled => {
                    let mut output = full.body.clone();
                    if !full.attachments.is_empty() {
                        output.push_str("\n\n---\n## Skill Attachments\n");
                        for att in &full.attachments {
                            output.push_str(&format!("\n### {}\n\n```\n{}\n```\n", att.path, att.content));
                        }
                    }
                    Ok(ToolResult::text(output))
                }
                Ok(_) => Ok(ToolResult::text(format!("Skill '{}' is disabled", slug))),
                Err(e) => Err(format!("Skill '{}' not found: {}", slug, e)),
            };
        }

        // read_mcp_resource 是元工具（按需读取 MCP 资源内容）
        if name == "read_mcp_resource" {
            let server_id = args
                .get("server_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: 'server_id'".to_string())?
                .to_string();
            let uri = args
                .get("uri")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: 'uri'".to_string())?
                .to_string();
            let state = ctx.app.state::<crate::state::AppState>();
            let mcp_manager = state.mcp_manager.clone();
            let text = mcp_manager.read_resource(&server_id, &uri).await?;
            return Ok(ToolResult::text(text));
        }

        if name == "exec_command" {
            return exec_tools::execute(args, ctx).await;
        }

        let category = tool_category(name);

        // 对高风险工具记录警告日志 + 确认拦截
        if is_dangerous_tool(name) {
            let args_summary = serde_json::to_string(&args).unwrap_or_default();
            let args_short = if args_summary.len() > 200 {
                &args_summary[..200]
            } else {
                &args_summary
            };
            crate::logger::warn(
                "ai-tools",
                format!("Executing dangerous tool: {} args={}", name, args_short),
            );

            // 检查是否需要用户确认
            let need_confirm = {
                let app_state = ctx.app.state::<crate::state::AppState>();
                let pref_svc = app_state
                    .app_preference_service
                    .lock()
                    .map_err(|_| "app_preference_service lock poisoned".to_string())?;
                let overrides = pref_svc.get_tool_confirmation_overrides();
                // 默认危险工具需要确认，除非用户明确关闭
                overrides.get(name).copied().unwrap_or(true)
            };

            if need_confirm {
                // 通过 Tauri 事件 + oneshot 通道请求用户确认
                let request_id = format!("tool-confirm-{}", uuid::Uuid::new_v4());
                let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

                // 注册 oneshot 通道到 AppState
                {
                    let state = ctx.app.state::<crate::state::AppState>();
                    let mut channels = state
                        .tool_confirmation_channels
                        .lock()
                        .map_err(|_| "tool_confirmation_channels lock poisoned".to_string())?;
                    channels.insert(request_id.clone(), tx);
                }

                // 发射确认请求事件到前端
                let payload = serde_json::json!({
                    "requestId": request_id,
                    "toolName": name,
                    "args": args,
                    "riskLevel": "dangerous",
                });
                ctx.app
                    .emit_to("main", "tool-confirmation-request", &payload)
                    .map_err(|e| format!("Failed to emit tool-confirmation-request: {e}"))?;

                // 等待前端响应（60 秒超时）
                let confirmed = tokio::time::timeout(std::time::Duration::from_secs(60), rx)
                    .await
                    .map_err(|_| {
                        // 超时，清理已注册的通道
                        let state = ctx.app.state::<crate::state::AppState>();
                        if let Ok(mut channels) = state.tool_confirmation_channels.lock() {
                            let _ = channels.remove(&request_id);
                        }
                        "Tool confirmation timed out (60s)".to_string()
                    })?
                    .map_err(|_| "Tool confirmation channel closed unexpectedly".to_string())?;

                if !confirmed {
                    return Ok(ToolResult::text("Operation cancelled by user"));
                }
            }
        }

        match category {
            "cdp" | "magic" | "utility" | "captcha" => {
                Self::execute_via_script_step(name, args, ctx).await
            }
            "app" => app_tools::execute(name, args, ctx).await,
            "auto" => auto_tools::execute(name, args, ctx).await,
            "file" => file_tools::execute(name, args, ctx).await,
            "dialog" => dialog_tools::execute(name, args, ctx).await,
            "skill" => skill_tools::execute(name, args, ctx).await,
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
        let category = tool_category(name);
        if category == "cdp" {
            let profile_id = ctx.current_profile_id.ok_or_else(|| {
                "当前会话未绑定工具目标环境，请先调用 app_set_chat_active_profile 或在聊天头部选择环境".to_string()
            })?;
            if ctx.cdp.is_none() {
                return Err(format!(
                    "当前工具目标环境 '{}' 的 CDP 不可用，请先启动该环境或切换到其他已运行环境",
                    profile_id
                ));
            }
        }
        if category == "magic" {
            let profile_id = ctx.current_profile_id.ok_or_else(|| {
                "当前会话未绑定工具目标环境，请先调用 app_set_chat_active_profile 或在聊天头部选择环境".to_string()
            })?;
            if ctx.magic_port.is_none() {
                return Err(format!(
                    "当前工具目标环境 '{}' 的 Magic Controller 不可用，请先启动该环境或切换到其他已运行环境",
                    profile_id
                ));
            }
        }

        // 注入 kind 字段，构造完整的 ScriptStep JSON
        let mut step_json = args;
        if let Some(obj) = step_json.as_object_mut() {
            obj.insert(
                "kind".to_string(),
                serde_json::Value::String(name.to_string()),
            );
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
            // 原图继续落盘；发给模型前再生成轻量版本。
            if let Some(ref file_path) = output {
                if let Ok(bytes) = tokio::fs::read(file_path).await {
                    let mime_hint = mime_hint_from_path(file_path);
                    let model_image = prepare_image_for_model_from_bytes(&bytes, mime_hint)
                        .map(|prepared| prepared.data_url)
                        .unwrap_or_else(|_| {
                            format!(
                                "data:{};base64,{}",
                                mime_hint.unwrap_or("image/png"),
                                base64_encode(&bytes)
                            )
                        });
                    return Ok(ToolResult::with_image(output, model_image, step_vars));
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

fn mime_hint_from_path(path: &str) -> Option<&'static str> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase());

    match ext.as_deref() {
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("png") => Some("image/png"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{all_dangerous_tool_names, tool_risk_level, ToolRiskLevel};

    #[test]
    fn device_preset_tool_risk_levels_match_plan() {
        assert_eq!(
            tool_risk_level("app_list_device_presets"),
            ToolRiskLevel::Safe
        );
        assert_eq!(
            tool_risk_level("app_get_device_preset"),
            ToolRiskLevel::Safe
        );
        assert_eq!(
            tool_risk_level("app_create_device_preset"),
            ToolRiskLevel::Moderate
        );
        assert_eq!(
            tool_risk_level("app_update_device_preset"),
            ToolRiskLevel::Dangerous
        );
        assert_eq!(
            tool_risk_level("app_delete_device_preset"),
            ToolRiskLevel::Dangerous
        );
    }

    #[test]
    fn dangerous_tool_list_includes_device_preset_mutations() {
        let dangerous = all_dangerous_tool_names();

        assert!(dangerous.contains(&"app_update_device_preset"));
        assert!(dangerous.contains(&"app_delete_device_preset"));
    }
}
