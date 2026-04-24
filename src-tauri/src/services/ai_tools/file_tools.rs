//! File I/O 工具 —— 安全的文件系统操作
//!
//! 提供读写文件、列目录、检查存在性等基本操作，
//! 带有大小限制和路径遍历保护。

#[cfg(test)]
use std::fs;
#[cfg(test)]
use std::path::{Component, Path, PathBuf};

use serde_json::{json, Value};

use super::{ToolContext, ToolResult};

/// 文件读取最大限制（10MB）
#[cfg(test)]
const MAX_READ_SIZE: u64 = 10 * 1024 * 1024;

/// 执行 file_* 类工具
pub async fn execute(
    name: &str,
    args: Value,
    ctx: &mut ToolContext<'_>,
) -> Result<ToolResult, String> {
    // 新增：多根目录工作区工具（需要 AppHandle）
    match name {
        "file_list_roots" => {
            let result = handle_file_list_roots(ctx.app)
                .await
                .map(|v| serde_json::to_string(&v).unwrap_or_else(|e| e.to_string()))
                .unwrap_or_else(|e| format!("错误: {e}"));
            return Ok(ToolResult::text(result));
        }
        "file_read_folder_desc" => {
            let root_id = args
                .get("root_id")
                .and_then(|v| v.as_str())
                .unwrap_or("default");
            let rel_path = args.get("rel_path").and_then(|v| v.as_str()).unwrap_or(".");
            let result = handle_file_read_folder_desc(ctx.app, root_id, rel_path)
                .await
                .map(|v| v.unwrap_or_else(|| "（暂无说明）".to_string()))
                .unwrap_or_else(|e| format!("错误: {e}"));
            return Ok(ToolResult::text(result));
        }
        "file_write_folder_desc" => {
            let root_id = args
                .get("root_id")
                .and_then(|v| v.as_str())
                .unwrap_or("default");
            let rel_path = args.get("rel_path").and_then(|v| v.as_str()).unwrap_or(".");
            let text = args.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let result = handle_file_write_folder_desc(ctx.app, root_id, rel_path, text)
                .await
                .map(|()| "说明已保存".to_string())
                .unwrap_or_else(|e| format!("错误: {e}"));
            return Ok(ToolResult::text(result));
        }
        _ => {}
    }

    // 通用文件工具：全部路由到 FsWorkspaceService，root_id 默认 "default"
    // 这样用户在设置中配置的自定义沙箱根和白名单目录才能对 AI 生效
    let root_id = args
        .get("root_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");
    let svc = crate::services::fs_workspace_service::from_app(ctx.app)
        .map_err(|e| format!("文件系统服务初始化失败: {e}"))?;

    match name {
        "file_read" => {
            let path = require_str(&args, "path")?;
            svc.read_file(root_id, &path)
                .map(ToolResult::text)
                .map_err(|e| e.to_string())
        }
        "file_write" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            let len = content.len();
            svc.write_file(root_id, &path, &content)
                .map(|_| ToolResult::text(format!("已写入 {} bytes 到 '{}'", len, path)))
                .map_err(|e| e.to_string())
        }
        "file_append" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            let len = content.len();
            svc.append_file(root_id, &path, &content)
                .map(|_| ToolResult::text(format!("已向 '{}' 追加 {} bytes", path, len)))
                .map_err(|e| e.to_string())
        }
        "file_list_dir" => {
            let path = require_str(&args, "path")?;
            svc.list_dir(root_id, &path)
                .map(|entries| {
                    ToolResult::text(serde_json::to_string(&entries).unwrap_or_default())
                })
                .map_err(|e| e.to_string())
        }
        "file_exists" => {
            let path = require_str(&args, "path")?;
            svc.path_exists(root_id, &path)
                .map(|(exists, is_dir)| {
                    ToolResult::text(
                        json!({
                            "exists": exists,
                            "is_dir": is_dir,
                            "is_file": exists && !is_dir,
                        })
                        .to_string(),
                    )
                })
                .map_err(|e| e.to_string())
        }
        "file_mkdir" => {
            let path = require_str(&args, "path")?;
            svc.mkdir(root_id, &path)
                .map(|_| ToolResult::text(format!("已创建目录 '{}'", path)))
                .map_err(|e| e.to_string())
        }
        "file_str_replace" => {
            let path = require_str(&args, "path")?;
            let old_str = require_str(&args, "old_str")?;
            let new_str = require_str(&args, "new_str")?;
            svc.str_replace_file(root_id, &path, &old_str, &new_str)
                .map(|_| ToolResult::text(format!("已完成 '{}' 中的字符串替换", path)))
                .map_err(|e| e.to_string())
        }
        _ => Err(format!("未知文件工具: '{name}'")),
    }
}

async fn handle_file_list_roots(
    app: &tauri::AppHandle,
) -> Result<Vec<crate::services::fs_workspace_service::FsRoot>, String> {
    crate::services::fs_workspace_service::from_app(app)
        .map_err(|e| e.to_string())?
        .list_roots()
        .map_err(|e| e.to_string())
}

async fn handle_file_read_folder_desc(
    app: &tauri::AppHandle,
    root_id: &str,
    rel_path: &str,
) -> Result<Option<String>, String> {
    crate::services::fs_workspace_service::from_app(app)
        .map_err(|e| e.to_string())?
        .read_description(root_id, rel_path)
        .map_err(|e| e.to_string())
}

async fn handle_file_write_folder_desc(
    app: &tauri::AppHandle,
    root_id: &str,
    rel_path: &str,
    text: &str,
) -> Result<(), String> {
    crate::services::fs_workspace_service::from_app(app)
        .map_err(|e| e.to_string())?
        .save_description(root_id, rel_path, text)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
fn execute_with_fs_root(name: &str, args: Value, fs_root: &Path) -> Result<ToolResult, String> {
    fs::create_dir_all(fs_root)
        .map_err(|e| format!("无法创建 fs 根目录 '{}': {}", fs_root.display(), e))?;

    match name {
        "file_read" => {
            let path = require_str(&args, "path")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            let metadata = fs::metadata(&resolved_path)
                .map_err(|e| format!("读取文件 '{}' 失败: {}", path, e))?;
            if metadata.len() > MAX_READ_SIZE {
                return Err(format!(
                    "文件 '{}' 过大（{} bytes，最大允许 {} bytes）",
                    path,
                    metadata.len(),
                    MAX_READ_SIZE
                ));
            }
            let content = fs::read_to_string(&resolved_path)
                .map_err(|e| format!("读取文件 '{}' 失败: {}", path, e))?;
            Ok(ToolResult::text(content))
        }

        "file_write" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            // 确保父目录存在
            if let Some(parent) = resolved_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
            }
            fs::write(&resolved_path, &content)
                .map_err(|e| format!("写入文件 '{}' 失败: {}", path, e))?;
            Ok(ToolResult::text(format!(
                "已写入 {} bytes 到 '{}'",
                content.len(),
                path
            )))
        }

        "file_append" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            use std::io::Write;
            let mut file = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&resolved_path)
                .map_err(|e| format!("打开文件 '{}' 以追加失败: {}", path, e))?;
            file.write_all(content.as_bytes())
                .map_err(|e| format!("追加写入文件 '{}' 失败: {}", path, e))?;
            Ok(ToolResult::text(format!(
                "已向 '{}' 追加 {} bytes",
                path,
                content.len(),
            )))
        }

        "file_list_dir" => {
            let path = require_str(&args, "path")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            let entries = fs::read_dir(&resolved_path)
                .map_err(|e| format!("读取目录 '{}' 失败: {}", path, e))?;
            let mut items = Vec::new();
            for entry in entries {
                let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
                let file_type = entry
                    .file_type()
                    .map_err(|e| format!("读取文件类型失败: {}", e))?;
                items.push(json!({
                    "name": entry.file_name().to_string_lossy(),
                    "is_dir": file_type.is_dir(),
                    "is_file": file_type.is_file(),
                }));
            }
            Ok(ToolResult::text(
                serde_json::to_string(&items).unwrap_or_default(),
            ))
        }

        "file_exists" => {
            let path = require_str(&args, "path")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            let exists = resolved_path.exists();
            let is_dir = resolved_path.is_dir();
            Ok(ToolResult::text(
                json!({
                    "exists": exists,
                    "is_dir": is_dir,
                    "is_file": exists && !is_dir,
                })
                .to_string(),
            ))
        }

        "file_mkdir" => {
            let path = require_str(&args, "path")?;
            let resolved_path = resolve_fs_path(fs_root, &path)?;
            fs::create_dir_all(&resolved_path)
                .map_err(|e| format!("创建目录 '{}' 失败: {}", path, e))?;
            Ok(ToolResult::text(format!("已创建目录 '{}'", path)))
        }

        _ => Err(format!("未知文件工具: '{name}'")),
    }
}

#[cfg(test)]
fn resolve_fs_path(fs_root: &Path, path: &str) -> Result<PathBuf, String> {
    validate_path(path)?;

    let mut resolved = fs_root.to_path_buf();
    if path == "." {
        return Ok(resolved);
    }

    for component in Path::new(path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => resolved.push(part),
            Component::ParentDir => {
                return Err("路径只能是 app 内 fs 文件系统中的相对路径，禁止使用 '..'".to_string())
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("路径只能是 app 内 fs 文件系统中的相对路径".to_string())
            }
        }
    }

    Ok(resolved)
}

// ─── 安全校验 ─────────────────────────────────────────────────────────

/// 路径安全校验：阻止空路径和路径遍历
#[cfg(test)]
fn validate_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("路径不能为空，且必须是 app 内 fs 文件系统中的相对路径".to_string());
    }
    if Path::new(path).is_absolute() || path.starts_with('\\') || has_windows_drive_prefix(path) {
        return Err("路径只能是 app 内 fs 文件系统中的相对路径".to_string());
    }

    let normalized = Path::new(path);
    for component in normalized.components() {
        if let std::path::Component::ParentDir = component {
            return Err("路径只能是 app 内 fs 文件系统中的相对路径，禁止使用 '..'".to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}

fn require_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| format!("Missing required parameter: '{key}'"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("multi-flow-{name}-{unique}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn resolve_fs_path_maps_dot_to_fs_root() {
        let app_data_dir = test_dir("app-data");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        let resolved = resolve_fs_path(&fs_root, ".").expect("resolve path");

        assert_eq!(resolved, fs_root);
    }

    #[test]
    fn resolve_fs_path_rejects_absolute_path() {
        let app_data_dir = test_dir("absolute-path");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        let err =
            resolve_fs_path(&fs_root, "/tmp/outside.txt").expect_err("absolute path should fail");

        assert!(err.contains("相对路径"), "unexpected error: {err}");
    }

    #[test]
    fn resolve_fs_path_rejects_windows_drive_path() {
        let app_data_dir = test_dir("windows-drive");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        let err = resolve_fs_path(&fs_root, "C:\\tmp\\outside.txt")
            .expect_err("windows absolute path should fail");

        assert!(err.contains("相对路径"), "unexpected error: {err}");
    }

    #[test]
    fn resolve_fs_path_rejects_parent_traversal() {
        let app_data_dir = test_dir("parent-traversal");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        let err = resolve_fs_path(&fs_root, "notes/../../outside.txt")
            .expect_err("path traversal should fail");

        assert!(err.contains(".."), "unexpected error: {err}");
    }

    #[test]
    fn resolve_fs_path_rejects_empty_path() {
        let app_data_dir = test_dir("empty-path");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        let err = resolve_fs_path(&fs_root, "").expect_err("empty path should fail");

        assert!(err.contains("不能为空"), "unexpected error: {err}");
    }

    #[test]
    fn file_write_and_append_only_touch_fs_root() {
        let app_data_dir = test_dir("write-append");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        execute_with_fs_root(
            "file_write",
            json!({ "path": "notes/todo.txt", "content": "hello" }),
            &fs_root,
        )
        .expect("write file");
        execute_with_fs_root(
            "file_append",
            json!({ "path": "notes/todo.txt", "content": "\nworld" }),
            &fs_root,
        )
        .expect("append file");

        let written_path = fs_root.join("notes").join("todo.txt");
        assert_eq!(
            fs::read_to_string(&written_path).expect("read written file"),
            "hello\nworld"
        );
        assert!(!app_data_dir.join("notes").join("todo.txt").exists());
    }

    #[test]
    fn file_list_dir_and_exists_read_from_fs_root() {
        let app_data_dir = test_dir("list-exists");
        let fs_root = app_data_dir.join("fs");
        let docs_dir = fs_root.join("docs");
        fs::create_dir_all(&docs_dir).expect("create docs dir");
        fs::write(docs_dir.join("note.txt"), "content").expect("seed file");

        let exists =
            execute_with_fs_root("file_exists", json!({ "path": "docs/note.txt" }), &fs_root)
                .expect("file exists");
        let list = execute_with_fs_root("file_list_dir", json!({ "path": "docs" }), &fs_root)
            .expect("list dir");

        assert_eq!(
            exists.text.expect("exists text"),
            json!({
                "exists": true,
                "is_dir": false,
                "is_file": true,
            })
            .to_string()
        );
        let items: Vec<Value> =
            serde_json::from_str(&list.text.expect("list text")).expect("parse list json");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["name"], "note.txt");
    }

    #[test]
    fn file_mkdir_creates_nested_directories_in_fs_root() {
        let app_data_dir = test_dir("mkdir");
        let fs_root = app_data_dir.join("fs");
        fs::create_dir_all(&fs_root).expect("create fs root");

        execute_with_fs_root("file_mkdir", json!({ "path": "nested/a/b" }), &fs_root)
            .expect("mkdir in fs root");

        assert!(fs_root.join("nested").join("a").join("b").is_dir());
        assert!(!app_data_dir.join("nested").join("a").join("b").exists());
    }
}
