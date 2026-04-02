//! App Data 工具 —— 通过 AppState 中的 Service 操作应用数据
//!
//! Profile / Group / Proxy / Plugin / EngineSession 的查询与管理。

use serde_json::{json, Value};
use tauri::Manager;

use crate::models::{
    CreateProfileGroupRequest, CreateProfileRequest, ListProfilesQuery,
    ListProxiesQuery, UpdateProfileGroupRequest,
};
use crate::state::AppState;

use super::{ToolContext, ToolResult};

/// 执行 app_* 类工具
pub async fn execute(name: &str, args: Value, ctx: &mut ToolContext<'_>) -> Result<ToolResult, String> {
    let state = ctx.app.state::<AppState>();

    match name {
        // ═══════════════ Profile 操作 ═══════════════
        "app_list_profiles" => {
            let group_id = args.get("group_id").and_then(|v| v.as_str()).map(String::from);
            let keyword = args.get("keyword").and_then(|v| v.as_str()).map(String::from);
            let include_deleted = args.get("include_deleted").and_then(|v| v.as_bool()).unwrap_or(false);

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
            Ok(ToolResult::text(serde_json::to_string(&resp).unwrap_or_default()))
        }

        "app_get_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let svc = state.lock_profile_service();
            let profile = svc.get_profile(&profile_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&profile).unwrap_or_default()))
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
            Ok(ToolResult::text(serde_json::to_string(&profile).unwrap_or_default()))
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
            let updated = svc.update_profile(&profile_id, req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&updated).unwrap_or_default()))
        }

        "app_delete_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let svc = state.lock_profile_service();
            let deleted = svc.soft_delete_profile(&profile_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("Profile '{}' deleted (soft)", deleted.id)))
        }

        "app_start_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            // 需要 EngineManager 来启动 profile
            let mut em = state.lock_engine_manager();
            let session = em.open_profile(&profile_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&session).unwrap_or_default()))
        }

        "app_stop_profile" => {
            let profile_id = require_str(&args, "profile_id")?;
            let mut em = state.lock_engine_manager();
            let session = em.close_profile(&profile_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&session).unwrap_or_default()))
        }

        "app_get_running_profiles" => {
            let mut em = state.lock_engine_manager();
            let states = em.list_window_states();
            Ok(ToolResult::text(serde_json::to_string(&states).unwrap_or_default()))
        }

        "app_get_current_profile" => {
            // 返回当前 run 绑定的 profile 信息（从 run_id 中提取 profile_id）
            // run_id 格式通常为 "{profile_id}:{timestamp}" 或纯 profile_id
            let run_id = ctx.run_id;
            let profile_id = run_id.split(':').next().unwrap_or(run_id);
            let svc = state.lock_profile_service();
            match svc.get_profile(profile_id) {
                Ok(profile) => Ok(ToolResult::text(serde_json::to_string(&profile).unwrap_or_default())),
                Err(e) => Ok(ToolResult::text(json!({
                    "run_id": run_id,
                    "error": e.to_string()
                }).to_string())),
            }
        }

        // ═══════════════ Group 操作 ═══════════════
        "app_list_groups" => {
            let include_deleted = args.get("include_deleted").and_then(|v| v.as_bool()).unwrap_or(false);
            let svc = state.profile_group_service.lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let resp = svc.list_groups(include_deleted).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&resp).unwrap_or_default()))
        }

        "app_get_group" => {
            let _group_id = require_str(&args, "group_id")?;
            // ProfileGroupService 没有单独的 get_group 方法
            // 通过 list_groups 过滤
            let svc = state.profile_group_service.lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let resp = svc.list_groups(false).map_err(|e| e.to_string())?;
            let found = resp.items.iter().find(|g| g.id == _group_id);
            match found {
                Some(group) => Ok(ToolResult::text(serde_json::to_string(group).unwrap_or_default())),
                None => Err(format!("Group '{}' not found", _group_id)),
            }
        }

        "app_create_group" => {
            let name_val = require_str(&args, "name")?;
            let note = opt_str(&args, "color"); // 前端用 note 存颜色
            let req = CreateProfileGroupRequest {
                name: name_val,
                note,
            };
            let svc = state.profile_group_service.lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let group = svc.create_group(req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&group).unwrap_or_default()))
        }

        "app_update_group" => {
            let group_id = require_str(&args, "group_id")?;
            let name_val = require_str(&args, "name").unwrap_or_default();
            let note = opt_str(&args, "color");
            let req = UpdateProfileGroupRequest {
                name: if name_val.is_empty() { "unnamed".to_string() } else { name_val },
                note,
            };
            let svc = state.profile_group_service.lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let group = svc.update_group(&group_id, req).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&group).unwrap_or_default()))
        }

        "app_delete_group" => {
            let group_id = require_str(&args, "group_id")?;
            let svc = state.profile_group_service.lock()
                .map_err(|_| "profile group service lock poisoned".to_string())?;
            let deleted = svc.soft_delete_group(&group_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(format!("Group '{}' deleted (soft)", deleted.id)))
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
            Ok(ToolResult::text(serde_json::to_string(&resp).unwrap_or_default()))
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
            Ok(ToolResult::text(serde_json::to_string(&resp).unwrap_or_default()))
        }

        "app_get_proxy" => {
            let proxy_id = require_str(&args, "proxy_id")?;
            let svc = state.lock_proxy_service();
            let proxy = svc.get_proxy(&proxy_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&proxy).unwrap_or_default()))
        }

        // ═══════════════ Plugin 操作 ═══════════════
        "app_list_plugins" => {
            let svc = state.plugin_package_service.lock()
                .map_err(|_| "plugin package service lock poisoned".to_string())?;
            let packages = svc.list_packages().map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&packages).unwrap_or_default()))
        }

        "app_get_plugin" => {
            let plugin_id = require_str(&args, "plugin_id")?;
            let svc = state.plugin_package_service.lock()
                .map_err(|_| "plugin package service lock poisoned".to_string())?;
            let package = svc.get_package(&plugin_id).map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&package).unwrap_or_default()))
        }

        // ═══════════════ Engine Session 查询 ═══════════════
        "app_get_engine_sessions" => {
            let svc = state.lock_engine_session_service();
            let sessions = svc.list_sessions().map_err(|e| e.to_string())?;
            Ok(ToolResult::text(serde_json::to_string(&sessions).unwrap_or_default()))
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
