use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::State;

use std::collections::HashMap;

use crate::models::{
    ApplyBookmarkTemplateRequest, BatchProfileActionItem, BatchProfileActionResponse,
    BookmarkDiffEntry, BookmarkDiffResult, BookmarkDisplayNode, BookmarkDisplayRoots,
    BookmarkStateFile, BookmarkStateNode, BookmarkTemplateItem, BookmarkTemplateSubscription,
    CreateBookmarkTemplateRequest, CreateProfileBookmarkRequest, GetProfileBookmarksResponse,
    ImportBookmarksRequest, MoveProfileBookmarkRequest, SubscribeTemplateRequest,
    UpdateBookmarkTemplateRequest, UpdateProfileBookmarkRequest,
};
use crate::state::AppState;

// ── Internal helpers ─────────────────────────────────────────────────────────

fn bookmark_state_path(state: &AppState, profile_id: &str) -> Result<PathBuf, String> {
    let em = state.lock_engine_manager();
    let (data_dir, _, _) = em
        .profile_data_dirs(profile_id)
        .map_err(|e| format!("profile dirs error: {e}"))?;
    Ok(data_dir.join("runtime").join("bookmark-state.json"))
}

fn get_magic_port(state: &AppState, profile_id: &str) -> Option<u16> {
    let em = state.lock_engine_manager();
    em.get_runtime_handle(profile_id)
        .ok()
        .and_then(|h| h.magic_port)
}

fn require_magic_port(state: &AppState, profile_id: &str) -> Result<u16, String> {
    get_magic_port(state, profile_id)
        .ok_or_else(|| format!("profile '{profile_id}' is not running"))
}

fn extract_magic_data(body: &str) -> Result<serde_json::Value, String> {
    let v: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("parse magic response: {e}"))?;
    if let Some(s) = v.get("status").and_then(|x| x.as_str()) {
        if s != "ok" {
            let msg = v
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown error");
            return Err(format!("magic error: {msg}"));
        }
    }
    Ok(v.get("data").cloned().unwrap_or(v))
}

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn state_node_to_display(node: &BookmarkStateNode) -> BookmarkDisplayNode {
    BookmarkDisplayNode {
        id: node.bookmark_id.clone(),
        node_id: None,
        bookmark_id: Some(node.bookmark_id.clone()),
        node_type: node.node_type.clone(),
        title: node.title.clone(),
        url: node.url.clone(),
        children: node
            .children
            .as_ref()
            .map(|ch| ch.iter().map(state_node_to_display).collect()),
        parent_id: None,
        index: None,
        managed: Some(true),
        root: None,
    }
}

fn parse_magic_node(v: &serde_json::Value) -> Option<BookmarkDisplayNode> {
    let node_id = v.get("node_id").and_then(|x| x.as_str())?.to_string();
    let node_type = v
        .get("type")
        .and_then(|x| x.as_str())
        .unwrap_or("url")
        .to_string();
    let title = v
        .get("title")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let bookmark_id = v
        .get("bookmark_id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let url = v.get("url").and_then(|x| x.as_str()).map(|s| s.to_string());
    let parent_id = v
        .get("parent_id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let index = v.get("index").and_then(|x| x.as_u64()).map(|n| n as u32);
    let managed = v.get("managed").and_then(|x| x.as_bool());
    let root = v
        .get("root")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let children = v.get("children").map(nodes_from_json_array);
    Some(BookmarkDisplayNode {
        id: node_id.clone(),
        node_id: Some(node_id),
        bookmark_id,
        node_type,
        title,
        url,
        children,
        parent_id,
        index,
        managed,
        root,
    })
}

fn nodes_from_json_array(arr: &serde_json::Value) -> Vec<BookmarkDisplayNode> {
    arr.as_array()
        .map(|a| a.iter().filter_map(parse_magic_node).collect())
        .unwrap_or_default()
}

fn root_children(roots_obj: &serde_json::Value, key: &str) -> Vec<BookmarkDisplayNode> {
    // Each root is a serialized node object; its children array holds the bookmarks.
    // Fallback: if shape collapses to a plain array, parse it directly.
    let Some(root) = roots_obj.get(key) else {
        return Vec::new();
    };
    if root.is_array() {
        return nodes_from_json_array(root);
    }
    root.get("children")
        .map(nodes_from_json_array)
        .unwrap_or_default()
}

fn roots_from_magic_data(data: &serde_json::Value) -> BookmarkDisplayRoots {
    // Chromium response: { roots: { bookmark_bar: <node>, other: <node>, mobile: <node> } }
    // Fallback to data itself if the `roots` wrapper is absent.
    let roots_obj = data.get("roots").unwrap_or(data);
    BookmarkDisplayRoots {
        bookmark_bar: root_children(roots_obj, "bookmark_bar"),
        other: root_children(roots_obj, "other"),
        mobile: root_children(roots_obj, "mobile"),
    }
}

async fn read_bookmark_state_file(path: &Path) -> Result<Option<BookmarkStateFile>, String> {
    if !tokio::fs::try_exists(path)
        .await
        .map_err(|e| format!("check bookmark-state.json: {e}"))?
    {
        return Ok(None);
    }
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("read bookmark-state.json: {e}"))?;
    let state: BookmarkStateFile =
        serde_json::from_str(&content).map_err(|e| format!("parse bookmark-state.json: {e}"))?;
    Ok(Some(state))
}

async fn write_bookmark_state_file(path: &Path, state: &BookmarkStateFile) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        tokio::fs::create_dir_all(dir)
            .await
            .map_err(|e| format!("create runtime dir: {e}"))?;
    }
    let content = serde_json::to_string_pretty(state)
        .map_err(|e| format!("serialize bookmark state: {e}"))?;
    tokio::fs::write(path, format!("{content}\n"))
        .await
        .map_err(|e| format!("write bookmark-state.json: {e}"))
}

// ── Tauri commands ───────────────────────────────────────────────────────────

/// Get the bookmark tree for a profile. Returns live data if running,
/// or the last snapshot from bookmark-state.json if stopped.
#[tauri::command]
pub async fn get_profile_bookmarks(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<GetProfileBookmarksResponse, String> {
    // Try live path first
    if let Some(port) = get_magic_port(&state, &profile_id) {
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();
        let body =
            super::automation_commands::magic_post(&client, port, json!({ "cmd": "get_bookmarks" }))
                .await?;
        let data = extract_magic_data(&body)?;
        return Ok(GetProfileBookmarksResponse {
            profile_id,
            is_live: true,
            snapshot_at: None,
            roots: roots_from_magic_data(&data),
        });
    }

    // Snapshot path
    let path = bookmark_state_path(&state, &profile_id)?;
    match read_bookmark_state_file(&path).await? {
        Some(file) => {
            let meta = tokio::fs::metadata(&path).await.ok();
            let snapshot_at = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64);
            let roots = BookmarkDisplayRoots {
                bookmark_bar: file
                    .roots
                    .bookmark_bar
                    .iter()
                    .map(state_node_to_display)
                    .collect(),
                other: file
                    .roots
                    .other
                    .iter()
                    .map(state_node_to_display)
                    .collect(),
                mobile: file
                    .roots
                    .mobile
                    .iter()
                    .map(state_node_to_display)
                    .collect(),
            };
            Ok(GetProfileBookmarksResponse {
                profile_id,
                is_live: false,
                snapshot_at,
                roots,
            })
        }
        None => Ok(GetProfileBookmarksResponse {
            profile_id,
            is_live: false,
            snapshot_at: None,
            roots: BookmarkDisplayRoots::default(),
        }),
    }
}

/// Create a bookmark (url node). Profile must be running.
#[tauri::command]
pub async fn create_profile_bookmark(
    state: State<'_, AppState>,
    req: CreateProfileBookmarkRequest,
) -> Result<(), String> {
    let port = require_magic_port(&state, &req.profile_id)?;
    let client = reqwest::Client::new();
    let mut payload = json!({
        "cmd": "create_bookmark",
        "parent_id": req.parent_id,
        "title": req.title,
        "url": req.url.unwrap_or_default(),
    });
    if let Some(idx) = req.index {
        payload["index"] = json!(idx);
    }
    let body = super::automation_commands::magic_post(&client, port, payload).await?;
    extract_magic_data(&body)?;
    Ok(())
}

/// Create a bookmark folder. Profile must be running.
#[tauri::command]
pub async fn create_profile_bookmark_folder(
    state: State<'_, AppState>,
    profile_id: String,
    parent_id: String,
    title: String,
    index: Option<u32>,
) -> Result<(), String> {
    let port = require_magic_port(&state, &profile_id)?;
    let client = reqwest::Client::new();
    let mut payload = json!({
        "cmd": "create_bookmark_folder",
        "parent_id": parent_id,
        "title": title,
    });
    if let Some(idx) = index {
        payload["index"] = json!(idx);
    }
    let body = super::automation_commands::magic_post(&client, port, payload).await?;
    extract_magic_data(&body)?;
    Ok(())
}

/// Update bookmark title and/or url. Profile must be running.
#[tauri::command]
pub async fn update_profile_bookmark(
    state: State<'_, AppState>,
    req: UpdateProfileBookmarkRequest,
) -> Result<(), String> {
    let port = require_magic_port(&state, &req.profile_id)?;
    let client = reqwest::Client::new();
    let mut payload = json!({ "cmd": "update_bookmark", "node_id": req.node_id });
    if let Some(t) = req.title {
        payload["title"] = json!(t);
    }
    if let Some(u) = req.url {
        payload["url"] = json!(u);
    }
    let body = super::automation_commands::magic_post(&client, port, payload).await?;
    extract_magic_data(&body)?;
    Ok(())
}

/// Move a bookmark or folder to a new parent. Profile must be running.
#[tauri::command]
pub async fn move_profile_bookmark(
    state: State<'_, AppState>,
    req: MoveProfileBookmarkRequest,
) -> Result<(), String> {
    let port = require_magic_port(&state, &req.profile_id)?;
    let client = reqwest::Client::new();
    let mut payload = json!({
        "cmd": "move_bookmark",
        "node_id": req.node_id,
        "new_parent_id": req.new_parent_id,
    });
    if let Some(idx) = req.index {
        payload["index"] = json!(idx);
    }
    let body = super::automation_commands::magic_post(&client, port, payload).await?;
    extract_magic_data(&body)?;
    Ok(())
}

/// Remove a bookmark or folder. Profile must be running.
#[tauri::command]
pub async fn remove_profile_bookmark(
    state: State<'_, AppState>,
    profile_id: String,
    node_id: String,
) -> Result<(), String> {
    let port = require_magic_port(&state, &profile_id)?;
    let client = reqwest::Client::new();
    let body = super::automation_commands::magic_post(
        &client,
        port,
        json!({ "cmd": "remove_bookmark", "node_id": node_id }),
    )
    .await?;
    extract_magic_data(&body)?;
    Ok(())
}

/// Export the bookmark tree as a BookmarkStateFile JSON string.
/// If running, uses export_bookmark_state for a live snapshot.
/// If stopped, reads the bookmark-state.json file directly.
#[tauri::command]
pub async fn export_profile_bookmarks(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<String, String> {
    if let Some(port) = get_magic_port(&state, &profile_id) {
        let client = reqwest::Client::new();
        let body = super::automation_commands::magic_post(
            &client,
            port,
            json!({ "cmd": "export_bookmark_state", "environment_id": profile_id }),
        )
        .await?;
        let data = extract_magic_data(&body)?;
        return Ok(data.to_string());
    }

    let path = bookmark_state_path(&state, &profile_id)?;
    if tokio::fs::try_exists(&path)
        .await
        .map_err(|e| format!("check bookmark-state.json: {e}"))?
    {
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("read bookmark-state.json: {e}"))?;
        return Ok(content);
    }
    Err(format!("No bookmark data for profile '{profile_id}'"))
}

/// Import bookmarks into a profile from a BookmarkStateFile JSON string.
/// Strategy: "mount_as_folder" (default), "merge", or "replace".
/// If running, uses Magic Controller. If stopped, writes bookmark-state.json
/// (takes effect on next profile launch via --bookmark-state-file).
#[tauri::command]
pub async fn import_bookmarks_to_profile(
    state: State<'_, AppState>,
    req: ImportBookmarksRequest,
) -> Result<(), String> {
    let import_state: BookmarkStateFile = serde_json::from_str(&req.state_json)
        .map_err(|e| format!("invalid bookmark state JSON: {e}"))?;

    if let Some(port) = get_magic_port(&state, &req.profile_id) {
        // Live path: apply via Magic Controller
        apply_state_to_running_profile(port, &import_state, &req.strategy, req.folder_title.as_deref()).await
    } else {
        // Offline path: write to bookmark-state.json (applied on next launch)
        let path = bookmark_state_path(&state, &req.profile_id)?;
        let final_state = match req.strategy.as_str() {
            "mount_as_folder" => {
                let folder_title = req.folder_title.as_deref().unwrap_or("Imported");
                // Wrap whole import in a single top-level folder under bookmark_bar
                let folder = BookmarkStateNode {
                    bookmark_id: format!("mf_import_{}", now_unix_ms()),
                    node_type: "folder".to_string(),
                    title: folder_title.to_string(),
                    url: None,
                    children: Some(import_state.roots.bookmark_bar),
                };
                let mut merged =
                    read_bookmark_state_file(&path)
                        .await?
                        .unwrap_or(BookmarkStateFile {
                            environment_id: Some(req.profile_id.clone()),
                            roots: Default::default(),
                        });
                merged.roots.bookmark_bar.push(folder);
                merged
            }
            "replace" => BookmarkStateFile {
                environment_id: Some(req.profile_id.clone()),
                roots: import_state.roots,
            },
            _ => {
                // merge: append all nodes from import (dedup by title+url is best-effort)
                let mut merged =
                    read_bookmark_state_file(&path)
                        .await?
                        .unwrap_or(BookmarkStateFile {
                            environment_id: Some(req.profile_id.clone()),
                            roots: Default::default(),
                        });
                merged.roots.bookmark_bar.extend(import_state.roots.bookmark_bar);
                merged.roots.other.extend(import_state.roots.other);
                merged.roots.mobile.extend(import_state.roots.mobile);
                merged
            }
        };
        write_bookmark_state_file(&path, &final_state).await
    }
}

async fn apply_state_to_running_profile(
    port: u16,
    import: &BookmarkStateFile,
    strategy: &str,
    folder_title: Option<&str>,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // Get bookmark_bar root node_id (needed as parent for new nodes)
    let body = super::automation_commands::magic_post(
        &client,
        port,
        json!({ "cmd": "get_bookmarks", "root": "bookmark_bar" }),
    )
    .await?;
    let data = extract_magic_data(&body)?;

    // With "root":"bookmark_bar", Chromium returns the root node object directly.
    let bar_node_id = data
        .get("node_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Determine parent_id for imported nodes
    let parent_id: String = if strategy == "mount_as_folder" {
        // Create a folder and use it as parent
        let title = folder_title.unwrap_or("Imported");
        let folder_body = super::automation_commands::magic_post(
            &client,
            port,
            json!({ "cmd": "create_bookmark_folder", "parent_id": bar_node_id.as_deref().unwrap_or("1"), "title": title }),
        )
        .await?;
        let folder_data = extract_magic_data(&folder_body)?;
        folder_data
            .get("node_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "1".to_string())
    } else {
        bar_node_id.unwrap_or_else(|| "1".to_string())
    };

    // Create all nodes recursively
    create_nodes_recursive(&client, port, &parent_id, &import.roots.bookmark_bar).await
}

fn create_nodes_recursive<'a>(
    client: &'a reqwest::Client,
    port: u16,
    parent_id: &'a str,
    nodes: &'a [BookmarkStateNode],
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        for node in nodes {
            match node.node_type.as_str() {
                "url" => {
                    let url = node.url.as_deref().unwrap_or("");
                    super::automation_commands::magic_post(
                        client,
                        port,
                        json!({
                            "cmd": "create_bookmark",
                            "parent_id": parent_id,
                            "title": node.title,
                            "url": url,
                        }),
                    )
                    .await?;
                }
                "folder" => {
                    let folder_body = super::automation_commands::magic_post(
                        client,
                        port,
                        json!({
                            "cmd": "create_bookmark_folder",
                            "parent_id": parent_id,
                            "title": node.title,
                        }),
                    )
                    .await?;
                    let folder_data = extract_magic_data(&folder_body)?;
                    if let Some(new_id) =
                        folder_data.get("node_id").and_then(|v| v.as_str())
                    {
                        if let Some(children) = &node.children {
                            create_nodes_recursive(client, port, new_id, children).await?;
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(())
    })
}

// ── Template commands (Phase 3) ───────────────────────────────────────────────

/// 列出所有书签模板
#[tauri::command]
pub async fn list_bookmark_templates(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BookmarkTemplateItem>, String> {
    state
        .lock_bookmark_template_service()
        .list_templates()
        .map_err(|e| e.to_string())
}

/// 创建书签模板
#[tauri::command]
pub async fn create_bookmark_template(
    state: tauri::State<'_, AppState>,
    req: CreateBookmarkTemplateRequest,
) -> Result<BookmarkTemplateItem, String> {
    state
        .lock_bookmark_template_service()
        .create_template(req)
        .map_err(|e| e.to_string())
}

/// 更新书签模板（version 自动 +1）
#[tauri::command]
pub async fn update_bookmark_template(
    state: tauri::State<'_, AppState>,
    req: UpdateBookmarkTemplateRequest,
) -> Result<BookmarkTemplateItem, String> {
    state
        .lock_bookmark_template_service()
        .update_template(req)
        .map_err(|e| e.to_string())
}

/// 删除书签模板（同时删除所有订阅）
#[tauri::command]
pub async fn delete_bookmark_template(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state
        .lock_bookmark_template_service()
        .delete_template(id)
        .map_err(|e| e.to_string())
}

/// 将书签模板批量下发到多个 profile
#[tauri::command]
pub async fn apply_bookmark_template(
    state: tauri::State<'_, AppState>,
    req: ApplyBookmarkTemplateRequest,
) -> Result<BatchProfileActionResponse, String> {
    // 先取模板数据（释放锁后再 await）
    let template = {
        state
            .lock_bookmark_template_service()
            .get_template(req.template_id)
            .map_err(|e| e.to_string())?
    };

    let import_state: BookmarkStateFile = serde_json::from_str(&template.tree_json)
        .map_err(|e| format!("invalid template tree_json: {e}"))?;

    let total = req.profile_ids.len();
    let mut items: Vec<BatchProfileActionItem> = Vec::with_capacity(total);

    for profile_id in &req.profile_ids {
        let result = apply_template_to_profile(
            &state,
            profile_id,
            &import_state,
            &req.strategy,
            req.folder_title.as_deref(),
        )
        .await;
        match result {
            Ok(()) => items.push(BatchProfileActionItem {
                profile_id: profile_id.clone(),
                ok: true,
                message: "ok".to_string(),
            }),
            Err(e) => items.push(BatchProfileActionItem {
                profile_id: profile_id.clone(),
                ok: false,
                message: e,
            }),
        }
    }

    let success_count = items.iter().filter(|i| i.ok).count();
    let failed_count = total - success_count;
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count,
        items,
    })
}

/// 对单个 profile 应用书签模板（内部辅助，支持 running / stopped 两种路径）
async fn apply_template_to_profile(
    state: &AppState,
    profile_id: &str,
    import: &BookmarkStateFile,
    strategy: &str,
    folder_title: Option<&str>,
) -> Result<(), String> {
    if let Some(port) = get_magic_port(state, profile_id) {
        // 在线路径：通过 Magic Controller 实时写入
        apply_state_to_running_profile(port, import, strategy, folder_title).await
    } else {
        // 离线路径：写入 bookmark-state.json（下次启动时生效）
        let path = bookmark_state_path(state, profile_id)?;
        let final_state = match strategy {
            "mount_as_folder" => {
                let title = folder_title.unwrap_or("Imported");
                let folder = BookmarkStateNode {
                    bookmark_id: format!("mf_import_{}", now_unix_ms()),
                    node_type: "folder".to_string(),
                    title: title.to_string(),
                    url: None,
                    children: Some(import.roots.bookmark_bar.clone()),
                };
                let mut merged =
                    read_bookmark_state_file(&path)
                        .await?
                        .unwrap_or(BookmarkStateFile {
                            environment_id: Some(profile_id.to_string()),
                            roots: Default::default(),
                        });
                merged.roots.bookmark_bar.push(folder);
                merged
            }
            "replace" => BookmarkStateFile {
                environment_id: Some(profile_id.to_string()),
                roots: import.roots.clone(),
            },
            _ => {
                // merge
                let mut merged =
                    read_bookmark_state_file(&path)
                        .await?
                        .unwrap_or(BookmarkStateFile {
                            environment_id: Some(profile_id.to_string()),
                            roots: Default::default(),
                        });
                merged
                    .roots
                    .bookmark_bar
                    .extend(import.roots.bookmark_bar.clone());
                merged.roots.other.extend(import.roots.other.clone());
                merged.roots.mobile.extend(import.roots.mobile.clone());
                merged
            }
        };
        write_bookmark_state_file(&path, &final_state).await
    }
}

// ── Subscription commands (Phase 4) ──────────────────────────────────────────

/// 订阅模板到 profile
#[tauri::command]
pub async fn subscribe_bookmark_template(
    state: tauri::State<'_, AppState>,
    req: SubscribeTemplateRequest,
) -> Result<(), String> {
    state
        .lock_bookmark_template_service()
        .subscribe(req)
        .map_err(|e| e.to_string())
}

/// 取消订阅
#[tauri::command]
pub async fn unsubscribe_bookmark_template(
    state: tauri::State<'_, AppState>,
    template_id: i64,
    profile_id: String,
) -> Result<(), String> {
    state
        .lock_bookmark_template_service()
        .unsubscribe(template_id, &profile_id)
        .map_err(|e| e.to_string())
}

/// 列出某模板的所有订阅
#[tauri::command]
pub async fn list_template_subscriptions(
    state: tauri::State<'_, AppState>,
    template_id: i64,
) -> Result<Vec<BookmarkTemplateSubscription>, String> {
    state
        .lock_bookmark_template_service()
        .list_subscriptions(template_id)
        .map_err(|e| e.to_string())
}

/// 列出某 profile 的所有订阅
#[tauri::command]
pub async fn list_profile_subscriptions(
    state: tauri::State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<BookmarkTemplateSubscription>, String> {
    state
        .lock_bookmark_template_service()
        .list_profile_subscriptions(&profile_id)
        .map_err(|e| e.to_string())
}

// ── Diff command (Phase 5) ────────────────────────────────────────────────────

/// 对比书签模板与某 profile 的当前书签，返回差异
#[tauri::command]
pub async fn diff_template_with_profile(
    state: tauri::State<'_, AppState>,
    template_id: i64,
    profile_id: String,
) -> Result<BookmarkDiffResult, String> {
    // 1. 获取模板 flat map
    let template = {
        state
            .lock_bookmark_template_service()
            .get_template(template_id)
            .map_err(|e| e.to_string())?
    };
    let template_state: BookmarkStateFile = serde_json::from_str(&template.tree_json)
        .map_err(|e| format!("invalid template tree_json: {e}"))?;
    let mut template_map: HashMap<String, BookmarkDisplayNode> = HashMap::new();
    flatten_state_nodes(
        &template_state
            .roots
            .bookmark_bar
            .iter()
            .map(state_node_to_display)
            .collect::<Vec<_>>(),
        "",
        &mut template_map,
    );
    flatten_state_nodes(
        &template_state
            .roots
            .other
            .iter()
            .map(state_node_to_display)
            .collect::<Vec<_>>(),
        "other",
        &mut template_map,
    );
    flatten_state_nodes(
        &template_state
            .roots
            .mobile
            .iter()
            .map(state_node_to_display)
            .collect::<Vec<_>>(),
        "mobile",
        &mut template_map,
    );

    // 2. 获取 profile 当前书签 flat map
    let mut profile_map: HashMap<String, BookmarkDisplayNode> = HashMap::new();

    if let Some(port) = get_magic_port(&state, &profile_id) {
        // 在线：从 Magic Controller 获取
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();
        let body = super::automation_commands::magic_post(
            &client,
            port,
            json!({ "cmd": "get_bookmarks" }),
        )
        .await?;
        let data = extract_magic_data(&body)?;
        let roots = roots_from_magic_data(&data);
        flatten_display_nodes(&roots.bookmark_bar, "", &mut profile_map);
        flatten_display_nodes(&roots.other, "other", &mut profile_map);
        flatten_display_nodes(&roots.mobile, "mobile", &mut profile_map);
    } else {
        // 离线：读取 bookmark-state.json
        let path = bookmark_state_path(&state, &profile_id)?;
        if let Some(file) = read_bookmark_state_file(&path).await? {
            let bm_bar: Vec<BookmarkDisplayNode> = file
                .roots
                .bookmark_bar
                .iter()
                .map(state_node_to_display)
                .collect();
            let other: Vec<BookmarkDisplayNode> =
                file.roots.other.iter().map(state_node_to_display).collect();
            let mobile: Vec<BookmarkDisplayNode> =
                file.roots.mobile.iter().map(state_node_to_display).collect();
            flatten_display_nodes(&bm_bar, "", &mut profile_map);
            flatten_display_nodes(&other, "other", &mut profile_map);
            flatten_display_nodes(&mobile, "mobile", &mut profile_map);
        }
    }

    // 3. 计算差异
    let mut added: Vec<BookmarkDiffEntry> = Vec::new();
    let mut removed: Vec<BookmarkDiffEntry> = Vec::new();
    let mut modified: Vec<BookmarkDiffEntry> = Vec::new();

    for (key, t_node) in &template_map {
        match profile_map.get(key) {
            None => {
                // 在模板中，不在 profile 中 → added（从 profile 视角看需要新增）
                added.push(BookmarkDiffEntry {
                    title: t_node.title.clone(),
                    url: t_node.url.clone(),
                    path: key.clone(),
                    node_type: t_node.node_type.clone(),
                });
            }
            Some(p_node) => {
                // 两者都有，但内容不同 → modified
                if t_node.url != p_node.url {
                    modified.push(BookmarkDiffEntry {
                        title: t_node.title.clone(),
                        url: t_node.url.clone(),
                        path: key.clone(),
                        node_type: t_node.node_type.clone(),
                    });
                }
            }
        }
    }

    for (key, p_node) in &profile_map {
        if !template_map.contains_key(key) {
            // 在 profile 中，不在模板中 → removed（相对模板而言是多余的）
            removed.push(BookmarkDiffEntry {
                title: p_node.title.clone(),
                url: p_node.url.clone(),
                path: key.clone(),
                node_type: p_node.node_type.clone(),
            });
        }
    }

    Ok(BookmarkDiffResult {
        added,
        removed,
        modified,
    })
}

// ── Diff 辅助：递归展平书签树为 {path → node} map ─────────────────────────────

/// 将 BookmarkStateNode 树展平为 HashMap，key 为 path/title
fn flatten_state_nodes(
    nodes: &[BookmarkDisplayNode],
    prefix: &str,
    out: &mut HashMap<String, BookmarkDisplayNode>,
) {
    for node in nodes {
        let path = if prefix.is_empty() {
            node.title.clone()
        } else {
            format!("{}/{}", prefix, node.title)
        };
        // 叶节点（url）或空文件夹才入 map；文件夹本身也入 map 以便比较
        out.insert(path.clone(), node.clone());
        if let Some(children) = &node.children {
            flatten_state_nodes(children, &path, out);
        }
    }
}

/// 将 BookmarkDisplayNode 树展平为 HashMap，key 为 path/title
fn flatten_display_nodes(
    nodes: &[BookmarkDisplayNode],
    prefix: &str,
    out: &mut HashMap<String, BookmarkDisplayNode>,
) {
    for node in nodes {
        let path = if prefix.is_empty() {
            node.title.clone()
        } else {
            format!("{}/{}", prefix, node.title)
        };
        out.insert(path.clone(), node.clone());
        if let Some(children) = &node.children {
            flatten_display_nodes(children, &path, out);
        }
    }
}
