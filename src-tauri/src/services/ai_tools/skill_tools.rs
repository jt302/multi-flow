//! Skill 管理工具 —— Agent 可通过这些工具创建、读取、更新、删除 skill，
//! 以及调整当前 session 中启用的 skill 列表。

use serde_json::Value;
use tauri::Manager;

use crate::services::ai_skill_service::{self, CreateSkillRequest, UpdateSkillRequest};
use crate::services::skill_install_service::InstallSkillRequest;
use crate::services::chat_service::{ChatService, UpdateChatSessionRequest};
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
                enable_for_session: Some(
                    args.get("enableForSession")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true),
                ),
                session_id: Some(
                    args.get("sessionId")
                        .and_then(|v| v.as_str())
                        .map(String::from)
                        .unwrap_or_else(|| ctx.run_id.to_string()),
                ),
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

        // ── Session 集成 ─────────────────────────────────────────────────────

        "skill_enable_for_session" => {
            let session_id = ctx.run_id.to_string();
            let add = opt_str_vec(&args, "add").unwrap_or_default();
            let remove = opt_str_vec(&args, "remove").unwrap_or_default();

            // 读取当前 session 的 enabled_skill_slugs
            let state = ctx.app.state::<AppState>();
            let chat_svc: ChatService = state
                .chat_service
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clone();
            let session = chat_svc
                .get_session(&session_id)
                .await
                .map_err(|e| e.to_string())?;

            let mut current: Vec<String> = session.enabled_skill_slugs.clone();

            // 增量更新
            for slug in &add {
                if !current.contains(slug) {
                    current.push(slug.clone());
                }
            }
            current.retain(|s| !remove.contains(s));

            // 过滤掉不存在的 slug
            let valid: Vec<String> = current
                .into_iter()
                .filter(|slug| svc.read_skill(slug).is_ok())
                .collect();

            let req = UpdateChatSessionRequest {
                title: None,
                profile_id: None,
                ai_config_id: None,
                system_prompt: None,
                tool_categories: None,
                profile_ids: None,
                active_profile_id: None,
                enabled_skill_slugs: Some(Some(valid.clone())),
                disabled_mcp_server_ids: None,
            };
            chat_svc
                .update_session(&session_id, req)
                .await
                .map_err(|e| e.to_string())?;

            Ok(ToolResult::text(format!(
                "Session skills updated: {}",
                valid.join(", ")
            )))
        }

        _ => Err(format!("Unknown skill tool: {name}")),
    }
}
