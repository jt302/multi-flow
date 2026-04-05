//! Auto 工具 —— 自动化管理 AI 工具执行器
//!
//! 涵盖：脚本 CRUD、运行管理、AI Provider 配置、CAPTCHA 配置。
//! 所有 `auto_*` 前缀工具均在此执行。

use serde_json::{json, Value};
use tauri::Manager;

use crate::models::CreateAutomationScriptRequest;
use crate::services::app_preference_service::AiConfigEntry;
use crate::services::captcha_service::CaptchaSolverConfig;
use crate::state::AppState;

use super::{ToolContext, ToolResult};

/// 执行 auto_* 类工具
pub async fn execute(
    name: &str,
    args: Value,
    ctx: &mut ToolContext<'_>,
) -> Result<ToolResult, String> {
    let state = ctx.app.state::<AppState>();

    match name {
        // ═══════════════ 脚本管理 ═══════════════
        "auto_list_scripts" => {
            let scripts = state
                .lock_automation_service()
                .list_scripts()
                .map_err(|e| e.to_string())?;
            // 返回摘要（不含完整步骤内容，减少 token）
            let summaries: Vec<Value> = scripts
                .iter()
                .map(|s| {
                    json!({
                        "id": s.id,
                        "name": s.name,
                        "description": s.description,
                        "step_count": s.steps.len(),
                        "associated_profile_ids": s.associated_profile_ids,
                        "ai_config_id": s.ai_config_id,
                        "created_at": s.created_at,
                        "updated_at": s.updated_at,
                    })
                })
                .collect();
            Ok(ToolResult::text(
                serde_json::to_string(&summaries).unwrap_or_default(),
            ))
        }

        "auto_get_script" => {
            let script_id = require_str(&args, "script_id")?;
            let script = state
                .lock_automation_service()
                .get_script(&script_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&script).unwrap_or_default(),
            ))
        }

        "auto_create_script" => {
            let name_val = require_str(&args, "name")?;
            let description = opt_str(&args, "description");
            let associated_profile_ids = args
                .get("associated_profile_ids")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                });
            let ai_config_id = opt_str(&args, "ai_config_id");
            let steps = args
                .get("steps")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let req = CreateAutomationScriptRequest {
                name: name_val,
                description,
                steps,
                associated_profile_ids,
                ai_config: None,
                ai_config_id,
                settings: None,
            };
            let script = state
                .lock_automation_service()
                .create_script(req)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&script).unwrap_or_default(),
            ))
        }

        "auto_update_script" => {
            let script_id = require_str(&args, "script_id")?;
            // 先获取现有脚本，叠加更新字段
            let existing = state
                .lock_automation_service()
                .get_script(&script_id)
                .map_err(|e| e.to_string())?;
            let name_val = opt_str(&args, "name").unwrap_or(existing.name);
            let description = if args.get("description").is_some() {
                opt_str(&args, "description")
            } else {
                existing.description
            };
            let associated_profile_ids = if args.get("associated_profile_ids").is_some() {
                args.get("associated_profile_ids")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
            } else {
                Some(existing.associated_profile_ids)
            };
            let ai_config_id = if args.get("ai_config_id").is_some() {
                opt_str(&args, "ai_config_id")
            } else {
                existing.ai_config_id
            };
            let steps = if args.get("steps").is_some() {
                args.get("steps")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or(existing.steps)
            } else {
                existing.steps
            };
            let req = CreateAutomationScriptRequest {
                name: name_val,
                description,
                steps,
                associated_profile_ids,
                ai_config: None,
                ai_config_id,
                settings: existing.settings,
            };
            let updated = state
                .lock_automation_service()
                .update_script(&script_id, req)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&updated).unwrap_or_default(),
            ))
        }

        "auto_delete_script" => {
            let script_id = require_str(&args, "script_id")?;
            state
                .lock_automation_service()
                .delete_script(&script_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("Script '{}' deleted", script_id)))
        }

        "auto_export_script" => {
            let script_id = require_str(&args, "script_id")?;
            let script = state
                .lock_automation_service()
                .get_script(&script_id)
                .map_err(|e| e.to_string())?;
            let json =
                serde_json::to_string_pretty(&script).map_err(|e| format!("序列化失败: {e}"))?;
            Ok(ToolResult::text(json))
        }

        // ═══════════════ 运行管理 ═══════════════
        "auto_run_script" => {
            let script_id = require_str(&args, "script_id")?;
            // 防递归：不允许运行当前正在执行的脚本
            {
                let svc = state.lock_automation_service();
                if let Ok(current_run) = svc.get_run(ctx.run_id) {
                    if current_run.script_id == script_id {
                        return Err(format!(
                            "拒绝递归：目标脚本 '{}' 正是当前正在执行的脚本",
                            script_id
                        ));
                    }
                }
            }
            let profile_id = opt_str(&args, "profile_id");
            let initial_vars: Option<std::collections::HashMap<String, String>> = args
                .get("initial_vars")
                .and_then(|v| serde_json::from_value(v.clone()).ok());
            let run_id = crate::commands::automation_commands::do_run_script(
                ctx.app,
                &state,
                &script_id,
                profile_id,
                initial_vars,
                None,
            )
            .await?;
            Ok(ToolResult::text(json!({ "run_id": run_id }).to_string()))
        }

        "auto_list_runs" => {
            let script_id = require_str(&args, "script_id")?;
            let runs = state
                .lock_automation_service()
                .list_runs(&script_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&runs).unwrap_or_default(),
            ))
        }

        "auto_list_active_runs" => {
            let tokens = state
                .cancel_tokens
                .lock()
                .map_err(|_| "lock poisoned".to_string())?;
            let run_ids: Vec<String> = tokens.keys().cloned().collect();
            Ok(ToolResult::text(
                serde_json::to_string(&run_ids).unwrap_or_default(),
            ))
        }

        "auto_get_run" => {
            let run_id = require_str(&args, "run_id")?;
            let run = state
                .lock_automation_service()
                .get_run(&run_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&run).unwrap_or_default(),
            ))
        }

        "auto_cancel_run" => {
            let run_id = require_str(&args, "run_id")?;
            state
                .cancel_tokens
                .lock()
                .map_err(|_| "lock poisoned".to_string())?
                .insert(run_id.clone(), true);
            if let Ok(mut channels) = state.active_run_channels.lock() {
                if let Some(tx) = channels.remove(&run_id) {
                    let _ = tx.send(None);
                }
            }
            Ok(ToolResult::text(format!(
                "Run '{}' cancel requested",
                run_id
            )))
        }

        // ═══════════════ AI 配置管理 ═══════════════
        "auto_list_ai_configs" => {
            let configs = state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .list_ai_configs()
                .map_err(|e| e.to_string())?;
            // 脱敏 API Key：仅显示末 4 位
            let masked: Vec<Value> = configs
                .iter()
                .map(|c| {
                    json!({
                        "id": c.id,
                        "name": c.name,
                        "provider": c.provider,
                        "base_url": c.base_url,
                        "api_key": mask_key(c.api_key.as_deref()),
                        "model": c.model,
                        "locale": c.locale,
                    })
                })
                .collect();
            Ok(ToolResult::text(
                serde_json::to_string(&masked).unwrap_or_default(),
            ))
        }

        "auto_create_ai_config" => {
            let name_val = require_str(&args, "name")?;
            let entry = AiConfigEntry {
                id: String::new(), // 由 service 生成
                name: name_val,
                provider: opt_str(&args, "provider"),
                base_url: opt_str(&args, "base_url"),
                api_key: opt_str(&args, "api_key"),
                model: opt_str(&args, "model"),
                locale: opt_str(&args, "locale"),
            };
            let created = state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .create_ai_config(entry)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&created).unwrap_or_default(),
            ))
        }

        "auto_update_ai_config" => {
            let id = require_str(&args, "id")?;
            let name_val = require_str(&args, "name")?;
            let entry = AiConfigEntry {
                id,
                name: name_val,
                provider: opt_str(&args, "provider"),
                base_url: opt_str(&args, "base_url"),
                api_key: opt_str(&args, "api_key"),
                model: opt_str(&args, "model"),
                locale: opt_str(&args, "locale"),
            };
            state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .update_ai_config(entry)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text("AI config updated".to_string()))
        }

        "auto_delete_ai_config" => {
            let id = require_str(&args, "id")?;
            state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .delete_ai_config(&id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("AI config '{}' deleted", id)))
        }

        // ═══════════════ CAPTCHA 配置管理 ═══════════════
        "auto_list_captcha_configs" => {
            let configs = state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .list_captcha_configs()
                .map_err(|e| e.to_string())?;
            // 脱敏 API Key
            let masked: Vec<Value> = configs
                .iter()
                .map(|c| {
                    json!({
                        "id": c.id,
                        "provider": c.provider,
                        "api_key": mask_key(Some(&c.api_key)),
                        "base_url": c.base_url,
                        "is_default": c.is_default,
                    })
                })
                .collect();
            Ok(ToolResult::text(
                serde_json::to_string(&masked).unwrap_or_default(),
            ))
        }

        "auto_create_captcha_config" => {
            let provider = require_str(&args, "provider")?;
            let api_key = require_str(&args, "api_key")?;
            let entry = CaptchaSolverConfig {
                id: String::new(),
                provider,
                api_key,
                base_url: opt_str(&args, "base_url"),
                is_default: args
                    .get("is_default")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
            };
            let created = state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .create_captcha_config(entry)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&created).unwrap_or_default(),
            ))
        }

        "auto_update_captcha_config" => {
            let id = require_str(&args, "id")?;
            let provider = require_str(&args, "provider")?;
            let api_key = require_str(&args, "api_key")?;
            let entry = CaptchaSolverConfig {
                id,
                provider,
                api_key,
                base_url: opt_str(&args, "base_url"),
                is_default: args
                    .get("is_default")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
            };
            state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .update_captcha_config(entry)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text("CAPTCHA config updated".to_string()))
        }

        "auto_delete_captcha_config" => {
            let id = require_str(&args, "id")?;
            state
                .app_preference_service
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .delete_captcha_config(&id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("CAPTCHA config '{}' deleted", id)))
        }

        _ => Err(format!("Unknown auto tool: '{name}'")),
    }
}

// ─── 参数辅助函数 ─────────────────────────────────────────────────────

fn require_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| format!("Missing required parameter: '{key}'"))
}

fn opt_str(args: &Value, key: &str) -> Option<String> {
    args.get(key).and_then(|v| v.as_str()).map(String::from)
}

/// API Key 脱敏：仅显示末 4 位，其余替换为 *
fn mask_key(key: Option<&str>) -> Option<String> {
    key.map(|k| {
        if k.len() <= 4 {
            "*".repeat(k.len())
        } else {
            format!("{}{}", "*".repeat(k.len() - 4), &k[k.len() - 4..])
        }
    })
}
