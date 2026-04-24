//! Skill 管理工具 —— Agent 可通过这些工具创建、读取、更新、删除和安装 skill。

use serde_json::Value;
use tauri::Manager;

use crate::services::ai_skill_service::{self, CreateSkillRequest, UpdateSkillRequest};
use crate::services::skill_install_service::InstallSkillRequest;
use crate::state::AppState;

use super::{ToolContext, ToolResult};

fn require_str<'a>(args: &'a Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Missing required parameter: '{key}'"))
}

fn opt_str_vec(args: &Value, key: &str) -> Option<Vec<String>> {
    args.get(key).and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect()
    })
}

pub async fn execute(
    name: &str,
    args: Value,
    ctx: &mut ToolContext<'_>,
) -> Result<ToolResult, String> {
    let svc = ai_skill_service::from_app(ctx.app)
        .map_err(|e| format!("Skill service error: {e}"))?;

    match name {
        // ── 只读操作 ─────────────────────────────────────────────────────────

        "skill_list" => {
            let metas = svc.list_skills().map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&metas).unwrap_or_default(),
            ))
        }

        "skill_read" => {
            let slug = require_str(&args, "slug")?;
            let full = svc.read_skill(slug).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&full).unwrap_or_default(),
            ))
        }

        // ── 写操作 ───────────────────────────────────────────────────────────

        "skill_create" => {
            let slug = require_str(&args, "slug")?.to_string();
            let name_val = require_str(&args, "name")?.to_string();
            let body = require_str(&args, "body")?.to_string();
            let req = CreateSkillRequest {
                slug: slug.clone(),
                name: name_val,
                description: args.get("description").and_then(|v| v.as_str()).map(String::from),
                version: args.get("version").and_then(|v| v.as_str()).map(String::from),
                enabled: args.get("enabled").and_then(|v| v.as_bool()),
                triggers: opt_str_vec(&args, "triggers"),
                allowed_tools: opt_str_vec(&args, "allowedTools"),
                model: args.get("model").and_then(|v| v.as_str()).map(String::from),
                body,
            };
            let full = svc.create_skill(req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&full).unwrap_or_default(),
            ))
        }

        "skill_update" => {
            let slug = require_str(&args, "slug")?;
            let req = UpdateSkillRequest {
                name: args.get("name").and_then(|v| v.as_str()).map(String::from),
                description: args.get("description").and_then(|v| v.as_str()).map(String::from),
                version: args.get("version").and_then(|v| v.as_str()).map(String::from),
                enabled: args.get("enabled").and_then(|v| v.as_bool()),
                triggers: opt_str_vec(&args, "triggers"),
                allowed_tools: opt_str_vec(&args, "allowedTools"),
                model: args.get("model").and_then(|v| v.as_str()).map(String::from),
                body: args.get("body").and_then(|v| v.as_str()).map(String::from),
            };
            let full = svc.update_skill(slug, req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&full).unwrap_or_default(),
            ))
        }

        "skill_delete" => {
            let slug = require_str(&args, "slug")?;
            svc.delete_skill(slug).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("Skill '{slug}' deleted")))
        }

        "skill_install" => {
            let source = require_str(&args, "source")?.to_string();
            let payload = InstallSkillRequest {
                source,
                source_type: args.get("sourceType").and_then(|v| v.as_str()).map(String::from),
                slug_hint: args.get("slugHint").and_then(|v| v.as_str()).map(String::from),
            };
            let state = ctx.app.state::<AppState>();
            let installed = crate::commands::ai_skill_commands::install_ai_skill_inner(
                ctx.app,
                &state,
                ctx.http_client,
                payload,
            )
            .await?;
            Ok(ToolResult::text(
                serde_json::to_string(&installed).unwrap_or_default(),
            ))
        }

        _ => Err(format!("Unknown skill tool: {name}")),
    }
}
