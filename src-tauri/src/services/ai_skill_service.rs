//! AI Skill 服务 —— Claude Code 风格 markdown skill 加载与管理
//!
//! Skill 存储位置：{appData/fs}/.agents/skills/<slug>/SKILL.md
//! frontmatter 格式（YAML）：name / slug / description / version / enabled / triggers / allowed_tools / model
//! body（frontmatter 之后的 markdown）在调用时注入 system prompt

use std::fs;
use std::path::{Component, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::state::ensure_app_fs_root;

/// skill 文件大小上限：64KB
const MAX_SKILL_SIZE: u64 = 64 * 1024;
/// 单个附件文件大小上限：32KB
const MAX_ATTACHMENT_SIZE: u64 = 32 * 1024;
/// 所有附件总大小上限：128KB
const MAX_ATTACHMENTS_TOTAL: u64 = 128 * 1024;
/// 允许加载附件的子目录名
const ATTACHMENT_DIRS: &[&str] = &["scripts", "references", "assets"];

// ─── 数据结构 ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMeta {
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub enabled: bool,
    pub triggers: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub model: Option<String>,
}

/// Skill 子目录中的附件文件（scripts/ references/ assets/）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillAttachment {
    /// 相对于 skill 目录的路径，如 scripts/helper.py
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFull {
    #[serde(flatten)]
    pub meta: SkillMeta,
    pub body: String,
    /// 来自 scripts/ references/ assets/ 子目录的附件
    pub attachments: Vec<SkillAttachment>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillRequest {
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub enabled: Option<bool>,
    pub triggers: Option<Vec<String>>,
    pub allowed_tools: Option<Vec<String>>,
    pub model: Option<String>,
    pub body: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkillRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub enabled: Option<bool>,
    pub triggers: Option<Vec<String>>,
    pub allowed_tools: Option<Vec<String>>,
    pub model: Option<String>,
    pub body: Option<String>,
}

// ─── YAML frontmatter 解析 ─────────────────────────────────────────────────

/// 从 markdown 中提取 YAML frontmatter 和 body
fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let after_open = &content[3..];
    // 寻找换行后的 "---"
    let close = after_open.find("\n---")?;
    let fm = &after_open[..close];
    let rest = &after_open[close + 4..]; // 跳过 "\n---"
    let body = rest.trim_start_matches('\n');
    Some((fm, body))
}

/// 用于反序列化 YAML frontmatter 的内部结构
#[derive(Deserialize, Default)]
struct RawFrontmatter {
    name: Option<String>,
    slug: Option<String>,
    description: Option<String>,
    version: Option<String>,
    enabled: Option<bool>,
    triggers: Option<Vec<String>>,
    allowed_tools: Option<Vec<String>>,
    /// Anthropic 标准字段名（连字符），与 allowed_tools（下划线）互为别名
    #[serde(rename = "allowed-tools")]
    allowed_tools_hyphen: Option<Vec<String>>,
    model: Option<String>,
}

/// 将 SKILL.md 内容解析为 SkillFull；slug 参数用于兜底
pub fn parse_skill_file(slug: &str, content: &str) -> AppResult<SkillFull> {
    let (fm_str, body) = split_frontmatter(content)
        .ok_or_else(|| AppError::Validation("SKILL.md 缺少 YAML frontmatter（需以 --- 开头）".into()))?;

    let raw: RawFrontmatter = serde_yaml::from_str(fm_str)
        .map_err(|e| AppError::Validation(format!("frontmatter YAML 解析失败: {e}")))?;

    let resolved_slug = raw.slug.as_deref().unwrap_or(slug).to_string();
    if !is_valid_slug(&resolved_slug) {
        return Err(AppError::Validation(format!(
            "slug '{resolved_slug}' 不合法，只允许 [a-z0-9-]+"
        )));
    }

    let meta = SkillMeta {
        slug: resolved_slug,
        name: raw.name.unwrap_or_else(|| slug.to_string()),
        description: raw.description,
        version: raw.version,
        enabled: raw.enabled.unwrap_or(true),
        triggers: raw.triggers.unwrap_or_default(),
        allowed_tools: raw.allowed_tools.or(raw.allowed_tools_hyphen).unwrap_or_default(),
        model: raw.model,
    };

    Ok(SkillFull { meta, body: body.to_string(), attachments: vec![] })
}

fn is_valid_slug(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

// ─── AiSkillService ────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AiSkillService {
    skills_root: PathBuf,
}

impl AiSkillService {
    pub fn new(app_fs_root: PathBuf) -> Self {
        Self { skills_root: app_fs_root.join(".agents").join("skills") }
    }

    fn skill_path(&self, slug: &str) -> AppResult<PathBuf> {
        // traversal 保护：slug 不允许包含路径分隔符
        let p = PathBuf::from(slug);
        if p.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir)) {
            return Err(AppError::Validation(format!("非法 slug: {slug}")));
        }
        if !is_valid_slug(slug) {
            return Err(AppError::Validation(format!("slug '{slug}' 只允许 [a-z0-9-]+")));
        }
        Ok(self.skills_root.join(slug).join("SKILL.md"))
    }

    pub fn list_skills(&self) -> AppResult<Vec<SkillMeta>> {
        if !self.skills_root.exists() {
            return Ok(vec![]);
        }
        let mut result = Vec::new();
        for entry in fs::read_dir(&self.skills_root).map_err(|e| {
            AppError::Validation(format!("读取 skills 目录失败: {e}"))
        })? {
            let entry = entry.map_err(|e| AppError::Validation(format!("遍历目录失败: {e}")))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let slug = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if !is_valid_slug(&slug) {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }
            match self.read_skill_file(&slug, &skill_md) {
                Ok(full) => result.push(full.meta),
                Err(e) => crate::logger::warn("ai-skill", format!("跳过无法解析的 skill '{slug}': {e}")),
            }
        }
        result.sort_by(|a, b| a.slug.cmp(&b.slug));
        Ok(result)
    }

    pub fn read_skill(&self, slug: &str) -> AppResult<SkillFull> {
        let path = self.skill_path(slug)?;
        if !path.exists() {
            return Err(AppError::NotFound(format!("skill '{slug}' 不存在")));
        }
        self.read_skill_file(slug, &path)
    }

    fn read_skill_file(&self, slug: &str, path: &PathBuf) -> AppResult<SkillFull> {
        let meta = fs::metadata(path).map_err(|e| AppError::Validation(format!("读取文件元信息失败: {e}")))?;
        if meta.len() > MAX_SKILL_SIZE {
            return Err(AppError::Validation(format!(
                "SKILL.md 超过最大限制 ({} bytes > {})",
                meta.len(),
                MAX_SKILL_SIZE
            )));
        }
        let content = fs::read_to_string(path)
            .map_err(|e| AppError::Validation(format!("读取 SKILL.md 失败: {e}")))?;
        let mut full = parse_skill_file(slug, &content)?;
        // 加载附件子目录（scripts/ references/ assets/）
        let skill_dir = path.parent().unwrap_or(path);
        full.attachments = load_attachments(skill_dir);
        Ok(full)
    }

    pub fn create_skill(&self, req: CreateSkillRequest) -> AppResult<SkillFull> {
        if !is_valid_slug(&req.slug) {
            return Err(AppError::Validation(format!("slug '{}' 不合法", req.slug)));
        }
        let dir = self.skills_root.join(&req.slug);
        if dir.exists() {
            return Err(AppError::Validation(format!("skill '{}' 已存在", req.slug)));
        }
        fs::create_dir_all(&dir)
            .map_err(|e| AppError::Validation(format!("创建 skill 目录失败: {e}")))?;

        let content = build_skill_content(
            &req.slug,
            &req.name,
            req.description.as_deref(),
            req.version.as_deref(),
            req.enabled.unwrap_or(true),
            &req.triggers.unwrap_or_default(),
            &req.allowed_tools.unwrap_or_default(),
            req.model.as_deref(),
            &req.body,
        );
        let path = dir.join("SKILL.md");
        fs::write(&path, &content)
            .map_err(|e| AppError::Validation(format!("写入 SKILL.md 失败: {e}")))?;

        parse_skill_file(&req.slug, &content)
    }

    pub fn update_skill(&self, slug: &str, req: UpdateSkillRequest) -> AppResult<SkillFull> {
        let existing = self.read_skill(slug)?;
        let meta = &existing.meta;

        let new_name = req.name.as_deref().unwrap_or(&meta.name);
        let new_desc = req.description.as_deref().or(meta.description.as_deref());
        let new_version = req.version.as_deref().or(meta.version.as_deref());
        let new_enabled = req.enabled.unwrap_or(meta.enabled);
        let new_triggers = req.triggers.as_deref().unwrap_or(&meta.triggers);
        let new_allowed_tools = req.allowed_tools.as_deref().unwrap_or(&meta.allowed_tools);
        let new_model = req.model.as_deref().or(meta.model.as_deref());
        let new_body = req.body.as_deref().unwrap_or(&existing.body);

        let content = build_skill_content(
            slug,
            new_name,
            new_desc,
            new_version,
            new_enabled,
            new_triggers,
            new_allowed_tools,
            new_model,
            new_body,
        );
        let path = self.skill_path(slug)?;
        fs::write(&path, &content)
            .map_err(|e| AppError::Validation(format!("写入 SKILL.md 失败: {e}")))?;

        parse_skill_file(slug, &content)
    }

    pub fn delete_skill(&self, slug: &str) -> AppResult<()> {
        let dir = self.skills_root.join(slug);
        if !is_valid_slug(slug) {
            return Err(AppError::Validation(format!("slug '{slug}' 不合法")));
        }
        if !dir.exists() {
            return Err(AppError::NotFound(format!("skill '{slug}' 不存在")));
        }
        fs::remove_dir_all(&dir)
            .map_err(|e| AppError::Validation(format!("删除 skill 目录失败: {e}")))
    }

    /// Progressive disclosure: 返回已启用 skill 的目录（slug + name + description），不含 body
    pub fn load_skill_directory(&self, slugs: &[String]) -> Vec<(String, String, Option<String>)> {
        slugs.iter().filter_map(|slug| {
            self.read_skill(slug).ok().and_then(|full| {
                if full.meta.enabled {
                    Some((full.meta.slug, full.meta.name, full.meta.description))
                } else {
                    None
                }
            })
        }).collect()
    }

    /// 收集所有已启用 skill 的 allowed_tools 并集（空表示无约束）
    /// 若任意 skill 指定了 allowed_tools，则自动包含 load_skill 本身
    pub fn get_allowed_tools_union(&self, slugs: &[String]) -> Vec<String> {
        let mut all: std::collections::HashSet<String> = std::collections::HashSet::new();
        for slug in slugs {
            if let Ok(full) = self.read_skill(slug) {
                if full.meta.enabled && !full.meta.allowed_tools.is_empty() {
                    for tool in &full.meta.allowed_tools {
                        all.insert(tool.clone());
                    }
                }
            }
        }
        if all.is_empty() {
            return vec![];
        }
        all.insert("load_skill".to_string());
        all.into_iter().collect()
    }

    /// 加载多个 skill 的 body，用于注入 system prompt（跳过 enabled=false 的 skill）
    /// 已废弃：新代码应使用 load_skill_directory + load_skill 工具（progressive disclosure）
    pub fn load_skill_bodies(&self, slugs: &[String]) -> Vec<(String, String)> {
        slugs.iter().filter_map(|slug| {
            self.read_skill(slug).ok().and_then(|full| {
                if full.meta.enabled {
                    Some((full.meta.name, full.body))
                } else {
                    None
                }
            })
        }).collect()
    }
}

// ─── 辅助函数 ──────────────────────────────────────────────────────────────

/// 扫描 skill 目录下的 scripts/ references/ assets/ 子目录，加载文本附件
fn load_attachments(skill_dir: &std::path::Path) -> Vec<SkillAttachment> {
    let mut attachments = Vec::new();
    let mut total_size: u64 = 0;

    for sub in ATTACHMENT_DIRS {
        let sub_dir = skill_dir.join(sub);
        if !sub_dir.is_dir() {
            continue;
        }
        let mut entries: Vec<_> = match fs::read_dir(&sub_dir) {
            Ok(r) => r.filter_map(|e| e.ok()).collect(),
            Err(_) => continue,
        };
        // 按文件名排序，保证注入顺序确定性
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if file_meta.len() > MAX_ATTACHMENT_SIZE {
                crate::logger::warn(
                    "ai-skill",
                    format!("附件 {:?} 超过单文件限制 {}B，跳过", path, MAX_ATTACHMENT_SIZE),
                );
                continue;
            }
            if total_size + file_meta.len() > MAX_ATTACHMENTS_TOTAL {
                crate::logger::warn("ai-skill", "附件总大小超过 128KB 限制，停止加载");
                return attachments;
            }
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue, // 非文本文件跳过
            };
            let rel_path = format!(
                "{}/{}",
                sub,
                path.file_name().and_then(|n| n.to_str()).unwrap_or("")
            );
            total_size += file_meta.len();
            attachments.push(SkillAttachment { path: rel_path, content });
        }
    }
    attachments
}

fn build_skill_content(
    slug: &str,
    name: &str,
    description: Option<&str>,
    version: Option<&str>,
    enabled: bool,
    triggers: &[String],
    allowed_tools: &[String],
    model: Option<&str>,
    body: &str,
) -> String {
    let mut fm = format!("---\nslug: {slug}\nname: {name}\n");
    if let Some(d) = description { fm.push_str(&format!("description: {d}\n")); }
    if let Some(v) = version { fm.push_str(&format!("version: {v}\n")); }
    fm.push_str(&format!("enabled: {enabled}\n"));
    if !triggers.is_empty() {
        fm.push_str("triggers:\n");
        for t in triggers { fm.push_str(&format!("  - {t}\n")); }
    }
    if !allowed_tools.is_empty() {
        fm.push_str("allowed_tools:\n");
        for t in allowed_tools { fm.push_str(&format!("  - {t}\n")); }
    }
    if let Some(m) = model { fm.push_str(&format!("model: {m}\n")); }
    fm.push_str("---\n");
    if !body.is_empty() {
        fm.push('\n');
        fm.push_str(body);
    }
    fm
}

/// 从 AppHandle 构造 AiSkillService
pub fn from_app(app: &tauri::AppHandle) -> AppResult<AiSkillService> {
    let fs_root = ensure_app_fs_root(app)?;
    Ok(AiSkillService::new(fs_root))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_skill_frontmatter() {
        let content = r#"---
slug: test-skill
name: 测试 Skill
description: 用于测试
version: 0.1.0
enabled: true
triggers:
  - manual
allowed_tools:
  - file_read
  - file_write
---

# 正文
这是 skill 的正文内容。
"#;
        let skill = parse_skill_file("test-skill", content).unwrap();
        assert_eq!(skill.meta.slug, "test-skill");
        assert_eq!(skill.meta.name, "测试 Skill");
        assert_eq!(skill.meta.allowed_tools, vec!["file_read", "file_write"]);
        assert!(skill.body.contains("正文"));
    }

    #[test]
    fn reject_missing_frontmatter() {
        let content = "# 没有 frontmatter\n正文内容";
        assert!(parse_skill_file("test", content).is_err());
    }

    #[test]
    fn reject_invalid_yaml() {
        let content = "---\n: invalid yaml\n---\nbody";
        assert!(parse_skill_file("test", content).is_err());
    }

    #[test]
    fn reject_invalid_slug() {
        let content = "---\nname: Test\n---\nbody";
        // slug 含大写
        assert!(parse_skill_file("Test-Skill", content).is_err());
    }

    #[test]
    fn build_and_parse_roundtrip() {
        let content = build_skill_content(
            "round-trip",
            "Round Trip",
            Some("测试往返"),
            Some("1.0.0"),
            true,
            &["manual".to_string()],
            &["file_read".to_string()],
            None,
            "body text",
        );
        let skill = parse_skill_file("round-trip", &content).unwrap();
        assert_eq!(skill.meta.slug, "round-trip");
        assert_eq!(skill.meta.name, "Round Trip");
        assert_eq!(skill.body, "body text");
    }

    #[test]
    fn allowed_tools_hyphen_alias() {
        let content = "---\nname: Test\nallowed-tools:\n  - file_read\n---\nbody";
        let skill = parse_skill_file("test", content).unwrap();
        assert_eq!(skill.meta.allowed_tools, vec!["file_read"]);
    }

    #[test]
    fn load_attachments_loads_scripts_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path();
        let scripts = skill_dir.join("scripts");
        std::fs::create_dir_all(&scripts).unwrap();
        std::fs::write(scripts.join("helper.py"), "print('hello')").unwrap();

        let attachments = load_attachments(skill_dir);
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].path, "scripts/helper.py");
        assert!(attachments[0].content.contains("hello"));
    }

    #[test]
    fn load_attachments_skips_oversized_file() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path();
        let refs = skill_dir.join("references");
        std::fs::create_dir_all(&refs).unwrap();
        // 写入超过 32KB 的文件
        let big = "x".repeat((MAX_ATTACHMENT_SIZE + 1) as usize);
        std::fs::write(refs.join("big.txt"), big).unwrap();

        let attachments = load_attachments(skill_dir);
        assert!(attachments.is_empty(), "超大附件应被跳过");
    }

    #[test]
    fn read_skill_file_includes_attachments() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path();
        // 写 SKILL.md
        let skill_md = skill_dir.join("SKILL.md");
        std::fs::write(&skill_md, "---\nname: With Attachments\n---\nbody text").unwrap();
        // 写附件
        let scripts = skill_dir.join("scripts");
        std::fs::create_dir_all(&scripts).unwrap();
        std::fs::write(scripts.join("run.sh"), "echo hi").unwrap();

        let svc = AiSkillService { skills_root: tmp.path().parent().unwrap().to_path_buf() };
        // 直接调内部方法（为测试构造路径）
        let full = svc.read_skill_file("dummy", &skill_md).unwrap();
        assert_eq!(full.attachments.len(), 1);
        assert_eq!(full.attachments[0].path, "scripts/run.sh");
    }

    #[test]
    fn new_service_uses_agents_skills_root() {
        let tmp = tempfile::TempDir::new().unwrap();
        let svc = AiSkillService::new(tmp.path().to_path_buf());

        assert_eq!(svc.skills_root, tmp.path().join(".agents").join("skills"));
    }

    #[test]
    fn create_and_read_skill_from_agents_skills_root() {
        let tmp = tempfile::TempDir::new().unwrap();
        let svc = AiSkillService::new(tmp.path().to_path_buf());

        svc.create_skill(CreateSkillRequest {
            slug: "demo-skill".to_string(),
            name: "Demo Skill".to_string(),
            description: Some("test skill".to_string()),
            version: Some("1.0.0".to_string()),
            enabled: Some(true),
            triggers: Some(vec!["manual".to_string()]),
            allowed_tools: Some(vec!["file_read".to_string()]),
            model: None,
            body: "body text".to_string(),
        })
        .unwrap();

        let skill_path = tmp
            .path()
            .join(".agents")
            .join("skills")
            .join("demo-skill")
            .join("SKILL.md");
        assert!(skill_path.exists());

        let full = svc.read_skill("demo-skill").unwrap();
        assert_eq!(full.meta.slug, "demo-skill");
        assert_eq!(full.body, "body text");
    }
}
