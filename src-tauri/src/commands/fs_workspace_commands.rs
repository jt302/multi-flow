//! 文件系统工作区 Tauri 命令
//!
//! 暴露给前端的 IPC 命令，支持：
//! - 列出/管理沙箱根目录和外部白名单
//! - 目录内容浏览、创建、删除
//! - 读写目录 description.md 说明文件

use tauri::{command, AppHandle};

use crate::services::app_preference_service::FsWhitelistEntry;
use crate::services::fs_workspace_service::{from_app, FsEntry, FsRoot};

/// 列出所有可访问的文件系统根目录
#[command]
pub async fn fs_list_roots(app: AppHandle) -> Result<Vec<FsRoot>, String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .list_roots()
        .map_err(|e| e.to_string())
}

/// 列出指定根目录下某相对路径的目录内容
#[command]
pub async fn fs_list_dir(
    app: AppHandle,
    root_id: String,
    rel_path: String,
) -> Result<Vec<FsEntry>, String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .list_dir(&root_id, &rel_path)
        .map_err(|e| e.to_string())
}

/// 在指定根目录下创建目录（递归）
#[command]
pub async fn fs_create_folder(
    app: AppHandle,
    root_id: String,
    rel_path: String,
) -> Result<(), String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .create_folder(&root_id, &rel_path)
        .map_err(|e| e.to_string())
}

/// 删除指定根目录下的文件或目录
#[command]
pub async fn fs_delete_entry(
    app: AppHandle,
    root_id: String,
    rel_path: String,
) -> Result<(), String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .delete_entry(&root_id, &rel_path)
        .map_err(|e| e.to_string())
}

/// 读取目录的 description.md 说明文件
#[command]
pub async fn fs_read_description(
    app: AppHandle,
    root_id: String,
    rel_path: String,
) -> Result<Option<String>, String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .read_description(&root_id, &rel_path)
        .map_err(|e| e.to_string())
}

/// 保存目录的 description.md 说明文件
#[command]
pub async fn fs_save_description(
    app: AppHandle,
    root_id: String,
    rel_path: String,
    text: String,
) -> Result<(), String> {
    from_app(&app)
        .map_err(|e| e.to_string())?
        .save_description(&root_id, &rel_path, &text)
        .map_err(|e| e.to_string())
}

/// 设置自定义沙箱根目录（None 恢复默认）
#[command]
pub async fn fs_set_sandbox_root(app: AppHandle, path: Option<String>) -> Result<(), String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .set_fs_sandbox_root(path)
        .map_err(|e| e.to_string())
}

/// 获取当前自定义沙箱根目录配置
#[command]
pub async fn fs_get_sandbox_root(app: AppHandle) -> Result<Option<String>, String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .get_fs_sandbox_root()
        .map_err(|e| e.to_string())
}

/// 获取外部白名单目录列表
#[command]
pub async fn fs_get_whitelist(app: AppHandle) -> Result<Vec<FsWhitelistEntry>, String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .get_fs_external_whitelist()
        .map_err(|e| e.to_string())
}

/// 添加外部白名单目录条目
#[command]
pub async fn fs_add_whitelist_entry(app: AppHandle, entry: FsWhitelistEntry) -> Result<(), String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .add_fs_whitelist_entry(entry)
        .map_err(|e| e.to_string())
}

/// 移除外部白名单目录条目
#[command]
pub async fn fs_remove_whitelist_entry(app: AppHandle, id: String) -> Result<(), String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .remove_fs_whitelist_entry(&id)
        .map_err(|e| e.to_string())
}

/// 更新外部白名单目录条目
#[command]
pub async fn fs_update_whitelist_entry(
    app: AppHandle,
    entry: FsWhitelistEntry,
) -> Result<(), String> {
    use crate::services::app_preference_service::AppPreferenceService;
    AppPreferenceService::from_app_handle(&app)
        .map_err(|e| e.to_string())?
        .update_fs_whitelist_entry(entry)
        .map_err(|e| e.to_string())
}
