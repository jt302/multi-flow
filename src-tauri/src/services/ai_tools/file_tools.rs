//! File I/O 工具 —— 安全的文件系统操作
//!
//! 提供读写文件、列目录、检查存在性等基本操作，
//! 带有大小限制和路径遍历保护。

use std::fs;
use std::path::Path;

use serde_json::{json, Value};

use super::{ToolContext, ToolResult};

/// 文件读取最大限制（10MB）
const MAX_READ_SIZE: u64 = 10 * 1024 * 1024;

/// 执行 file_* 类工具
pub async fn execute(
    name: &str,
    args: Value,
    _ctx: &mut ToolContext<'_>,
) -> Result<ToolResult, String> {
    match name {
        "file_read" => {
            let path = require_str(&args, "path")?;
            validate_path(&path)?;
            let metadata =
                fs::metadata(&path).map_err(|e| format!("Cannot read file '{}': {}", path, e))?;
            if metadata.len() > MAX_READ_SIZE {
                return Err(format!(
                    "File '{}' is too large ({} bytes, max {})",
                    path,
                    metadata.len(),
                    MAX_READ_SIZE
                ));
            }
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read '{}': {}", path, e))?;
            Ok(ToolResult::text(content))
        }

        "file_write" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            validate_path(&path)?;
            // 确保父目录存在
            if let Some(parent) = Path::new(&path).parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            fs::write(&path, &content).map_err(|e| format!("Failed to write '{}': {}", path, e))?;
            Ok(ToolResult::text(format!(
                "Written {} bytes to '{}'",
                content.len(),
                path
            )))
        }

        "file_append" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            validate_path(&path)?;
            use std::io::Write;
            let mut file = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
                .map_err(|e| format!("Failed to open '{}' for append: {}", path, e))?;
            file.write_all(content.as_bytes())
                .map_err(|e| format!("Failed to append to '{}': {}", path, e))?;
            Ok(ToolResult::text(format!(
                "Appended {} bytes to '{}'",
                content.len(),
                path
            )))
        }

        "file_list_dir" => {
            let path = require_str(&args, "path")?;
            validate_path(&path)?;
            let entries = fs::read_dir(&path)
                .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;
            let mut items = Vec::new();
            for entry in entries {
                let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
                let file_type = entry
                    .file_type()
                    .map_err(|e| format!("File type error: {}", e))?;
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
            validate_path(&path)?;
            let exists = Path::new(&path).exists();
            let is_dir = Path::new(&path).is_dir();
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
            validate_path(&path)?;
            fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create directory '{}': {}", path, e))?;
            Ok(ToolResult::text(format!("Directory created: '{}'", path)))
        }

        _ => Err(format!("Unknown file tool: '{name}'")),
    }
}

// ─── 安全校验 ─────────────────────────────────────────────────────────

/// 路径安全校验：阻止空路径和路径遍历
fn validate_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    // 阻止路径遍历
    let normalized = Path::new(path);
    for component in normalized.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Path traversal (..) is not allowed".to_string());
        }
    }
    Ok(())
}

fn require_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| format!("Missing required parameter: '{key}'"))
}
