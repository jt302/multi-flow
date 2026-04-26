//! Chat 附件落盘 helper：把进入 chat 流程的内联 base64 图片
//! 写到 `<APPDATA>/chat-attachments/<session_id>/` 下，返回绝对路径。
//!
//! 目的：让 `chat_message.image_base64` 列永远写 None，所有图片以路径形式
//! 存在 `image_ref` 列；webview / messages 内存只持路径，
//! 调 LLM 前由 `ai_service::expand_image_refs` 现读现压成 data URL。

use std::path::PathBuf;

use base64::Engine;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};

/// 把内联 base64（可带 `data:image/png;base64,` 前缀）落盘到
/// `<APPDATA>/chat-attachments/<session_id>/<timestamp>-<uuid>.<ext>`
/// 返回绝对路径字符串，可直接放进 `chat_message.image_ref` 列。
///
/// 输入若为空字符串或全空白，直接返回 Err（调用方应预先检查 Some/None）。
pub fn externalize_inline_image(
    app: &AppHandle,
    session_id: &str,
    image_base64_or_data_url: &str,
) -> AppResult<String> {
    let trimmed = image_base64_or_data_url.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(
            "externalize_inline_image: empty image input".to_string(),
        ));
    }

    let (mime, data_b64) = if trimmed.starts_with("data:") {
        crate::services::model_image_service::split_data_url(trimmed)
            .ok_or_else(|| AppError::Validation("invalid data url".to_string()))?
    } else {
        ("image/png", trimmed)
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_b64)
        .map_err(|e| AppError::Validation(format!("base64 decode failed: {e}")))?;

    let ext = mime_to_ext(mime);
    let dir = chat_attachments_dir(app, session_id)?;
    std::fs::create_dir_all(&dir).map_err(AppError::from)?;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let unique = uuid::Uuid::new_v4().simple().to_string();
    let filename = format!("{now_ms}-{unique}.{ext}");
    let path = dir.join(filename);
    std::fs::write(&path, &bytes).map_err(AppError::from)?;
    Ok(path.to_string_lossy().to_string())
}

/// `<APPDATA>/chat-attachments/<session_id>` （dev 模式自动落到 `$APPDATA/dev/...`）
fn chat_attachments_dir(app: &AppHandle, session_id: &str) -> AppResult<PathBuf> {
    let safe_session = sanitize_session_id(session_id);
    Ok(crate::state::resolve_app_data_dir(app)?
        .join("chat-attachments")
        .join(safe_session))
}

/// 防御：session_id 来自 DB，理论上是 UUID；但仍做基础清洗避免路径穿越
fn sanitize_session_id(id: &str) -> String {
    id.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

fn mime_to_ext(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "png",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_path_traversal_chars() {
        assert_eq!(sanitize_session_id("../etc/passwd"), "etcpasswd");
        assert_eq!(sanitize_session_id("a/b\\c"), "abc");
        assert_eq!(
            sanitize_session_id("550e8400-e29b-41d4-a716-446655440000"),
            "550e8400-e29b-41d4-a716-446655440000"
        );
    }

    #[test]
    fn mime_to_ext_falls_back_to_png() {
        assert_eq!(mime_to_ext("image/png"), "png");
        assert_eq!(mime_to_ext("image/jpeg"), "jpg");
        assert_eq!(mime_to_ext("image/webp"), "webp");
        assert_eq!(mime_to_ext("application/octet-stream"), "png");
    }
}
