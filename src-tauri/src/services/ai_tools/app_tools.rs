//! App Data 工具 —— 通过 AppState 中的 Service 操作应用数据
//!
//! Profile / Group / Proxy / Plugin / EngineSession 的查询与管理。

use serde_json::{json, Value};
use tauri::Manager;

use crate::models::{
    CreateProfileGroupRequest, CreateProfileRequest, ListProfilesQuery, ListProxiesQuery,
    SaveProfileDevicePresetRequest, ToolbarLabelMode, UpdateProfileGroupRequest,
};
use crate::services::chat_service::UpdateChatSessionRequest;
use crate::state::AppState;

use super::{ToolContext, ToolResult};

/// 将 profile_id 参数规整：若收到占位字符串（current / active / self）则自动解析为当前会话绑定的环境 ID
fn resolve_profile_id_arg(raw: String, ctx: &ToolContext<'_>) -> Result<String, String> {
    match raw.to_lowercase().as_str() {
        "current" | "active" | "self" | "me" | "" => ctx
            .current_profile_id
            .ok_or_else(|| {
                "当前会话未绑定工具目标环境，无法解析占位 profile_id。请先在聊天头部选择环境或调用 app_set_chat_active_profile".to_string()
            })
            .map(|s| s.to_string()),
        _ => Ok(raw),
    }
}

/// 执行 app_* 类工具
pub async fn execute(
    name: &str,
    args: Value,
    ctx: &mut ToolContext<'_>,
) -> Result<ToolResult, String> {
    let state = ctx.app.state::<AppState>();

    match name {
        // ═══════════════ Profile 操作 ═══════════════
        "app_list_profiles" => {
            let group_id = args
                .get("group_id")
                .and_then(|v| v.as_str())
                .map(String::from);
            let keyword = args
                .get("keyword")
                .and_then(|v| v.as_str())
                .map(String::from);
            let include_deleted = args
                .get("include_deleted")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let query = ListProfilesQuery {
                include_deleted,
                page: 1,
                page_size: 1000,
                keyword,
                group: group_id,
                running: None,
            };
            let svc = state.lock_profile_service();
            let resp = svc.list_profiles(query).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&resp).unwrap_or_default(),
            ))
        }

        "app_get_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let svc = state.lock_profile_service();
            let profile = svc.get_profile(&profile_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&profile).unwrap_or_default(),
            ))
        }

        "app_create_profile" => {
            let name_val = require_str(&args, "name")?;
            let group_id = opt_str(&args, "group_id");
            let note = opt_str(&args, "note");
            let req = CreateProfileRequest {
                name: name_val,
                group: group_id,
                note,
                proxy_id: None,
                settings: None,
            };
            let svc = state.lock_profile_service();
            let profile = svc.create_profile(req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&profile).unwrap_or_default(),
            ))
        }

        "app_update_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let svc = state.lock_profile_service();
            // 先获取现有 profile，然后叠加更新字段
            let existing = svc.get_profile(&profile_id).map_err(|e| e.to_string())?;
            let name_val = opt_str(&args, "name").unwrap_or(existing.name);
            let group_id = if args.get("group_id").is_some() {
                opt_str(&args, "group_id")
            } else {
                existing.group
            };
            let note = if args.get("note").is_some() {
                opt_str(&args, "note")
            } else {
                existing.note
            };
            let req = CreateProfileRequest {
                name: name_val,
                group: group_id,
                note,
                proxy_id: None,
                settings: None,
            };
            let updated = svc
                .update_profile(&profile_id, req)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&updated).unwrap_or_default(),
            ))
        }

        "app_delete_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let svc = state.lock_profile_service();
            let deleted = svc
                .soft_delete_profile(&profile_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!(
                "Profile '{}' deleted (soft)",
                deleted.id
            )))
        }

        "app_start_profile" => {
            let profile_id = resolve_profile_id_arg(require_str(&args, "profile_id")?, ctx)?;
            // 复用 UI 的完整启动流程：指纹解析、代理设置、Cookie/扩展状态加载、
            // mark_profile_running(true)、save_session 等
            let resp = crate::commands::profile_commands::do_open_profile(
                state.inner(),
                Some(ctx.app),
                None, // task_id
                &profile_id,
                None, // user_options（使用 profile 已配置参数）
            )?;
            Ok(ToolResult::text(
                serde_json::to_string(&resp.session).unwrap_or_default(),
            ))
        }

        "app_stop_profile" => {
            let profile_id = resolve_profile_id_arg(require_str(&args, "profile_id")?, ctx)?;
            // 复用 UI 的完整关闭流程：Cookie 快照、mark_profile_running(false)、delete_session
            let profile =
                crate::commands::profile_commands::do_close_profile(state.inner(), &profile_id)?;
            Ok(ToolResult::text(
                serde_json::to_string(&profile).unwrap_or_default(),
            ))
        }

        "app_get_running_profiles" => {
            let mut em = state.lock_engine_manager();
            let states = em.list_window_states();
            Ok(ToolResult::text(
                serde_json::to_string(&states).unwrap_or_default(),
            ))
        }

        "app_set_chat_active_profile" => {
            let profile_id = resolve_profile_id_arg(require_str(&args, "profile_id")?, ctx)?;
            let chat_svc = state
                .chat_service
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clone();
            let session = chat_svc
                .get_session(ctx.run_id)
                .await
                .map_err(|_| "app_set_chat_active_profile 仅支持 AI 聊天会话".to_string())?;
            let allowed_profile_ids = session
                .profile_ids
                .clone()
                .or_else(|| session.profile_id.clone().map(|id| vec![id]))
                .unwrap_or_default();
            if allowed_profile_ids.is_empty() {
                return Err("当前聊天会话未关联任何可操作环境".to_string());
            }
            if !allowed_profile_ids.iter().any(|id| id == &profile_id) {
                return Err(format!(
                    "环境 '{}' 不在当前聊天会话的可操作范围内，请先把它加入当前会话",
                    profile_id
                ));
            }

            let updated = chat_svc
                .update_session(
                    &session.id,
                    UpdateChatSessionRequest {
                        title: None,
                        profile_id: None,
                        ai_config_id: None,
                        system_prompt: None,
                        tool_categories: None,
                        profile_ids: None,
                        active_profile_id: Some(Some(profile_id)),
                        enabled_skill_slugs: None,
                        disabled_mcp_server_ids: None,
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
            crate::services::chat_service::emit_chat_session_updated(ctx.app, &updated);
            Ok(ToolResult::text(
                serde_json::to_string(&updated).unwrap_or_default(),
            ))
        }

        "app_get_current_profile" => {
            let Some(profile_id) = ctx.current_profile_id else {
                return Ok(ToolResult::text(json!({
                    "currentProfileId": null,
                    "message": "当前未绑定工具目标环境，请先调用 app_set_chat_active_profile 或在聊天头部选择环境"
                }).to_string()));
            };
            let svc = state.lock_profile_service();
            match svc.get_profile(profile_id) {
                Ok(profile) => Ok(ToolResult::text(
                    serde_json::to_string(&profile).unwrap_or_default(),
                )),
                Err(e) => Ok(ToolResult::text(
                    json!({
                        "currentProfileId": profile_id,
                        "error": e.to_string()
                    })
                    .to_string(),
                )),
            }
        }

        // ═══════════════ Device Preset 操作 ═══════════════
        "app_list_device_presets" => {
            let platform = opt_str(&args, "platform");
            let svc = state
                .device_preset_service
                .lock()
                .map_err(|_| "device preset service lock poisoned".to_string())?;
            let presets = svc
                .list_presets(platform.as_deref(), None)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&presets).unwrap_or_default(),
            ))
        }

        "app_get_device_preset" => {
            let preset_id = require_str(&args, "preset_id")?;
            let svc = state
                .device_preset_service
                .lock()
                .map_err(|_| "device preset service lock poisoned".to_string())?;
            let preset = svc.get_preset(&preset_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&preset).unwrap_or_default(),
            ))
        }

        "app_create_device_preset" => {
            let payload = parse_device_preset_request(&args)?;
            let svc = state
                .device_preset_service
                .lock()
                .map_err(|_| "device preset service lock poisoned".to_string())?;
            let preset = svc.create_preset(payload).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&preset).unwrap_or_default(),
            ))
        }

        "app_update_device_preset" => {
            let preset_id = require_str(&args, "preset_id")?;
            let payload = parse_device_preset_request(&args)?;
            let svc = state
                .device_preset_service
                .lock()
                .map_err(|_| "device preset service lock poisoned".to_string())?;
            let preset = svc
                .update_preset(&preset_id, payload)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&preset).unwrap_or_default(),
            ))
        }

        "app_delete_device_preset" => {
            let preset_id = require_str(&args, "preset_id")?;
            let svc = state
                .device_preset_service
                .lock()
                .map_err(|_| "device preset service lock poisoned".to_string())?;
            svc.delete_preset(&preset_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!(
                "Device preset '{preset_id}' deleted"
            )))
        }

        // ═══════════════ Group 操作 ═══════════════
        "app_list_groups" => {
            let include_deleted = args
                .get("include_deleted")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let svc = state
                .profile_group_service
                .lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let resp = svc
                .list_groups(include_deleted)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&resp).unwrap_or_default(),
            ))
        }

        "app_get_group" => {
            let _group_id = require_str(&args, "group_id")?;
            // ProfileGroupService 没有单独的 get_group 方法
            // 通过 list_groups 过滤
            let svc = state
                .profile_group_service
                .lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let resp = svc.list_groups(false).map_err(|e| e.to_string())?;
            let found = resp.items.iter().find(|g| g.id == _group_id);
            match found {
                Some(group) => Ok(ToolResult::text(
                    serde_json::to_string(group).unwrap_or_default(),
                )),
                None => Err(format!("Group '{}' not found", _group_id)),
            }
        }

        "app_create_group" => {
            let name_val = require_str(&args, "name")?;
            let browser_bg_color =
                opt_str(&args, "browser_bg_color").or_else(|| opt_str(&args, "color"));
            let req = CreateProfileGroupRequest {
                name: name_val,
                note: None,
                browser_bg_color,
                toolbar_label_mode: opt_str(&args, "toolbar_label_mode")
                    .as_deref()
                    .map(parse_toolbar_label_mode_arg),
            };
            let svc = state
                .profile_group_service
                .lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let group = svc.create_group(req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&group).unwrap_or_default(),
            ))
        }

        "app_update_group" => {
            let group_id = require_str(&args, "group_id")?;
            let name_val = require_str(&args, "name").unwrap_or_default();
            let browser_bg_color =
                opt_str(&args, "browser_bg_color").or_else(|| opt_str(&args, "color"));
            let req = UpdateProfileGroupRequest {
                name: if name_val.is_empty() {
                    "unnamed".to_string()
                } else {
                    name_val
                },
                note: None,
                browser_bg_color,
                toolbar_label_mode: opt_str(&args, "toolbar_label_mode")
                    .as_deref()
                    .map(parse_toolbar_label_mode_arg),
            };
            let svc = state
                .profile_group_service
                .lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let group = svc
                .update_group(&group_id, req)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&group).unwrap_or_default(),
            ))
        }

        "app_delete_group" => {
            let group_id = require_str(&args, "group_id")?;
            let svc = state
                .profile_group_service
                .lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let deleted = svc
                .soft_delete_group(&group_id)
                .map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!(
                "Group '{}' deleted (soft)",
                deleted.id
            )))
        }

        "app_get_profiles_in_group" => {
            let group_id = require_str(&args, "group_id")?;
            let query = ListProfilesQuery {
                include_deleted: false,
                page: 1,
                page_size: 1000,
                keyword: None,
                group: Some(group_id),
                running: None,
            };
            let svc = state.lock_profile_service();
            let resp = svc.list_profiles(query).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&resp).unwrap_or_default(),
            ))
        }

        // ═══════════════ Proxy 操作 ═══════════════
        "app_list_proxies" => {
            let keyword = opt_str(&args, "keyword");
            let protocol = opt_str(&args, "protocol");
            let query = ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 1000,
                keyword,
                protocol,
                country: None,
                check_status: None,
            };
            let svc = state.lock_proxy_service();
            let resp = svc.list_proxies(query).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&resp).unwrap_or_default(),
            ))
        }

        "app_get_proxy" => {
            let proxy_id = require_str(&args, "proxy_id")?;
            let svc = state.lock_proxy_service();
            let proxy = svc.get_proxy(&proxy_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&proxy).unwrap_or_default(),
            ))
        }

        // ═══════════════ Plugin 操作 ═══════════════
        "app_list_plugins" => {
            let svc = state
                .plugin_package_service
                .lock()
                .map_err(|_| "plugin package service lock poisoned".to_string())?;
            let packages = svc.list_packages().map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&packages).unwrap_or_default(),
            ))
        }

        "app_get_plugin" => {
            let plugin_id = require_str(&args, "plugin_id")?;
            let svc = state
                .plugin_package_service
                .lock()
                .map_err(|_| "plugin package service lock poisoned".to_string())?;
            let package = svc.get_package(&plugin_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&package).unwrap_or_default(),
            ))
        }

        // ═══════════════ Engine Session 查询 ═══════════════
        "app_get_engine_sessions" => {
            let svc = state.lock_engine_session_service();
            let sessions = svc.list_sessions().map_err(|e| e.to_string())?;
            Ok(ToolResult::text(
                serde_json::to_string(&sessions).unwrap_or_default(),
            ))
        }

        _ => Err(format!("Unknown app tool: '{name}'")),
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

fn require_bool(args: &Value, key: &str) -> Result<bool, String> {
    args.get(key)
        .and_then(|v| v.as_bool())
        .ok_or_else(|| format!("Missing required boolean parameter: '{key}'"))
}

fn require_u32(args: &Value, key: &str) -> Result<u32, String> {
    let value = args
        .get(key)
        .and_then(|v| v.as_u64())
        .ok_or_else(|| format!("Missing required numeric parameter: '{key}'"))?;
    u32::try_from(value).map_err(|_| format!("Parameter '{key}' is out of range for u32"))
}

fn require_f32(args: &Value, key: &str) -> Result<f32, String> {
    let value = args
        .get(key)
        .and_then(|v| v.as_f64())
        .ok_or_else(|| format!("Missing required numeric parameter: '{key}'"))?;
    if !value.is_finite() {
        return Err(format!("Parameter '{key}' must be a finite number"));
    }
    Ok(value as f32)
}

fn parse_device_preset_request(args: &Value) -> Result<SaveProfileDevicePresetRequest, String> {
    Ok(SaveProfileDevicePresetRequest {
        label: require_str(args, "label")?,
        platform: require_str(args, "platform")?,
        platform_version: require_str(args, "platform_version")?,
        viewport_width: require_u32(args, "viewport_width")?,
        viewport_height: require_u32(args, "viewport_height")?,
        device_scale_factor: require_f32(args, "device_scale_factor")?,
        touch_points: require_u32(args, "touch_points")?,
        custom_platform: require_str(args, "custom_platform")?,
        arch: require_str(args, "arch")?,
        bitness: require_str(args, "bitness")?,
        mobile: require_bool(args, "mobile")?,
        form_factor: require_str(args, "form_factor")?,
        user_agent_template: require_str(args, "user_agent_template")?,
        custom_gl_vendor: require_str(args, "custom_gl_vendor")?,
        custom_gl_renderer: require_str(args, "custom_gl_renderer")?,
        custom_cpu_cores: require_u32(args, "custom_cpu_cores")?,
        custom_ram_gb: require_u32(args, "custom_ram_gb")?,
        browser_version: require_str(args, "browser_version").unwrap_or_default(),
    })
}

fn parse_toolbar_label_mode_arg(value: &str) -> ToolbarLabelMode {
    match value {
        "group_name_and_id" => ToolbarLabelMode::GroupNameAndId,
        _ => ToolbarLabelMode::IdOnly,
    }
}
