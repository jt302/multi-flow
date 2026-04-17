//! 文件系统工作区服务
//!
//! 提供多根目录的安全文件系统访问，支持：
//! - 默认沙箱根：{appData}/fs
//! - 自定义沙箱根：用户在设置中指定的路径
//! - 外部白名单目录：用户手动添加的外部目录（各自有 allowWrite 权限）

use std::path::{Component, Path, PathBuf};
use std::fs;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::services::app_preference_service::AppPreferenceService;
use crate::state::ensure_app_fs_root;

/// 文件系统根目录描述
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsRoot {
    pub id: String,
    pub label: String,
    pub path_display: String,
    pub allow_write: bool,
    pub is_default: bool,
}

/// 文件系统目录条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub rel_path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified_at: Option<i64>,
    pub has_description: bool,
}

pub struct FsWorkspaceService {
    app: AppHandle,
}

impl FsWorkspaceService {
    pub fn from_app(app: &AppHandle) -> AppResult<Self> {
        Ok(Self { app: app.clone() })
    }

    /// 列出所有可访问的文件系统根目录
    pub fn list_roots(&self) -> AppResult<Vec<FsRoot>> {
        let pref_svc = AppPreferenceService::from_app_handle(&self.app)?;
        let sandbox_root_override = pref_svc.get_fs_sandbox_root()?;
        let whitelist = pref_svc.get_fs_external_whitelist()?;

        let mut roots = Vec::new();

        // 默认/自定义沙箱根
        let (default_path, default_label) = if let Some(ref custom) = sandbox_root_override {
            (PathBuf::from(custom), custom.clone())
        } else {
            let p = ensure_app_fs_root(&self.app)?;
            (p.clone(), p.to_string_lossy().to_string())
        };
        // 确保路径变量被使用（避免 unused 警告）
        let _ = default_path;

        roots.push(FsRoot {
            id: "default".to_string(),
            label: "AI 沙箱".to_string(),
            path_display: default_label,
            allow_write: true,
            is_default: true,
        });

        // 外部白名单
        for entry in whitelist {
            roots.push(FsRoot {
                id: entry.id,
                label: entry.label,
                path_display: entry.path,
                allow_write: entry.allow_write,
                is_default: false,
            });
        }

        Ok(roots)
    }

    /// 列出指定根目录下某路径的目录内容
    pub fn list_dir(&self, root_id: &str, rel_path: &str) -> AppResult<Vec<FsEntry>> {
        let (root_path, _allow_write) = self.get_root_base(root_id)?;
        let target = self.safe_join(&root_path, rel_path)?;

        if !target.is_dir() {
            return Err(AppError::Validation(format!("路径不是目录: {rel_path}")));
        }

        let mut entries = Vec::new();
        for entry in fs::read_dir(&target)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            let meta = entry.metadata()?;
            let is_dir = meta.is_dir();
            let size = if is_dir { None } else { Some(meta.len()) };
            let modified_at = meta.modified().ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64);

            let child_rel = if rel_path.is_empty() || rel_path == "." {
                name.clone()
            } else {
                format!("{}/{}", rel_path.trim_end_matches('/'), name)
            };

            let has_description = if is_dir {
                target.join(&name).join("description.md").exists()
            } else {
                false
            };

            entries.push(FsEntry {
                name,
                rel_path: child_rel,
                is_dir,
                size,
                modified_at,
                has_description,
            });
        }

        // 目录优先，名称排序
        entries.sort_by(|a, b| {
            b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
        });

        Ok(entries)
    }

    /// 创建目录（递归）
    pub fn create_folder(&self, root_id: &str, rel_path: &str) -> AppResult<()> {
        let (root_path, allow_write) = self.get_root_base(root_id)?;
        if !allow_write {
            return Err(AppError::Validation("该根目录为只读，不允许创建文件夹".to_string()));
        }
        let target = self.safe_join(&root_path, rel_path)?;
        fs::create_dir_all(&target)?;
        Ok(())
    }

    /// 删除文件或目录
    pub fn delete_entry(&self, root_id: &str, rel_path: &str) -> AppResult<()> {
        let (root_path, allow_write) = self.get_root_base(root_id)?;
        if !allow_write {
            return Err(AppError::Validation("该根目录为只读，不允许删除".to_string()));
        }
        let target = self.safe_join(&root_path, rel_path)?;
        // 禁止删除根目录本身
        if target == root_path {
            return Err(AppError::Validation("不允许删除根目录本身".to_string()));
        }
        if target.is_dir() {
            fs::remove_dir_all(&target)?;
        } else {
            fs::remove_file(&target)?;
        }
        Ok(())
    }

    /// 读取目录的 description.md 说明文件
    pub fn read_description(&self, root_id: &str, rel_path: &str) -> AppResult<Option<String>> {
        let (root_path, _) = self.get_root_base(root_id)?;
        let dir = self.safe_join(&root_path, rel_path)?;
        let desc_path = dir.join("description.md");
        if desc_path.exists() {
            Ok(Some(fs::read_to_string(&desc_path)?))
        } else {
            Ok(None)
        }
    }

    /// 保存目录的 description.md 说明文件
    pub fn save_description(&self, root_id: &str, rel_path: &str, text: &str) -> AppResult<()> {
        let (root_path, allow_write) = self.get_root_base(root_id)?;
        if !allow_write {
            return Err(AppError::Validation("该根目录为只读，不允许写入说明".to_string()));
        }
        let dir = self.safe_join(&root_path, rel_path)?;
        if !dir.is_dir() {
            return Err(AppError::Validation(format!("路径不是目录: {rel_path}")));
        }
        fs::write(dir.join("description.md"), text)?;
        Ok(())
    }

    /// 获取根目录路径和写权限
    fn get_root_base(&self, root_id: &str) -> AppResult<(PathBuf, bool)> {
        if root_id == "default" {
            let pref_svc = AppPreferenceService::from_app_handle(&self.app)?;
            let path = if let Some(custom) = pref_svc.get_fs_sandbox_root()? {
                PathBuf::from(custom)
            } else {
                ensure_app_fs_root(&self.app)?
            };
            fs::create_dir_all(&path)?;
            return Ok((path, true));
        }

        let pref_svc = AppPreferenceService::from_app_handle(&self.app)?;
        let whitelist = pref_svc.get_fs_external_whitelist()?;
        let entry = whitelist.into_iter()
            .find(|e| e.id == root_id)
            .ok_or_else(|| AppError::Validation(format!("未找到根目录: {root_id}")))?;

        let path = PathBuf::from(&entry.path);
        if !path.exists() {
            return Err(AppError::Validation(format!("路径不存在: {}", entry.path)));
        }
        Ok((path, entry.allow_write))
    }

    // ─── AI 工具使用的文件 I/O 方法 ──────────────────────────────────────────

    /// 读取文件内容（最大 10MB）
    pub fn read_file(&self, root_id: &str, rel_path: &str) -> AppResult<String> {
        let (root_path, _) = self.get_root_base(root_id)?;
        let target = self.safe_join(&root_path, rel_path)?;
        let meta = fs::metadata(&target)
            .map_err(|e| AppError::Validation(format!("读取 '{}' 失败: {e}", rel_path)))?;
        const MAX_READ: u64 = 10 * 1024 * 1024;
        if meta.len() > MAX_READ {
            return Err(AppError::Validation(format!(
                "文件过大 ({} bytes，上限 {} bytes)", meta.len(), MAX_READ
            )));
        }
        fs::read_to_string(&target)
            .map_err(|e| AppError::Validation(format!("读取 '{}' 失败: {e}", rel_path)))
    }

    /// 覆盖写入文件（最大 10MB，自动创建父目录）
    pub fn write_file(&self, root_id: &str, rel_path: &str, content: &str) -> AppResult<()> {
        let (root_path, allow_write) = self.get_root_base(root_id)?;
        if !allow_write {
            return Err(AppError::Validation("该根目录为只读，不允许写入文件".to_string()));
        }
        const MAX_WRITE: usize = 10 * 1024 * 1024;
        if content.len() > MAX_WRITE {
            return Err(AppError::Validation(format!(
                "内容过大 ({} bytes，上限 {} bytes)", content.len(), MAX_WRITE
            )));
        }
        let target = self.safe_join(&root_path, rel_path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, content)
            .map_err(|e| AppError::Validation(format!("写入 '{}' 失败: {e}", rel_path)))
    }

    /// 追加写入文件（最大单次 10MB）
    pub fn append_file(&self, root_id: &str, rel_path: &str, content: &str) -> AppResult<()> {
        let (root_path, allow_write) = self.get_root_base(root_id)?;
        if !allow_write {
            return Err(AppError::Validation("该根目录为只读，不允许追加文件".to_string()));
        }
        const MAX_WRITE: usize = 10 * 1024 * 1024;
        if content.len() > MAX_WRITE {
            return Err(AppError::Validation(format!(
                "追加内容过大 ({} bytes，上限 {} bytes)", content.len(), MAX_WRITE
            )));
        }
        let target = self.safe_join(&root_path, rel_path)?;
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true).append(true).open(&target)
            .map_err(|e| AppError::Validation(format!("打开 '{}' 失败: {e}", rel_path)))?;
        file.write_all(content.as_bytes())
            .map_err(|e| AppError::Validation(format!("追加 '{}' 失败: {e}", rel_path)))
    }

    /// 检查路径是否存在，返回 (exists, is_dir)
    pub fn path_exists(&self, root_id: &str, rel_path: &str) -> AppResult<(bool, bool)> {
        let (root_path, _) = self.get_root_base(root_id)?;
        let target = self.safe_join(&root_path, rel_path)?;
        let exists = target.exists();
        let is_dir = target.is_dir();
        Ok((exists, is_dir))
    }

    /// 创建目录（供 AI 工具调用的 alias）
    pub fn mkdir(&self, root_id: &str, rel_path: &str) -> AppResult<()> {
        self.create_folder(root_id, rel_path)
    }

    /// 安全路径拼接：拒绝 .. 和绝对路径
    fn safe_join(&self, root: &Path, rel: &str) -> AppResult<PathBuf> {
        if rel.is_empty() || rel == "." {
            return Ok(root.to_path_buf());
        }
        let mut resolved = root.to_path_buf();
        for component in Path::new(rel).components() {
            match component {
                Component::Normal(part) => resolved.push(part),
                Component::CurDir => {}
                Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                    return Err(AppError::Validation("非法路径：禁止使用 .. 或绝对路径".to_string()));
                }
            }
        }
        Ok(resolved)
    }
}

/// 便捷构造函数（供命令层和工具层调用）
pub fn from_app(app: &AppHandle) -> AppResult<FsWorkspaceService> {
    FsWorkspaceService::from_app(app)
}
