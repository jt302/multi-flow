use std::fs;
use std::path::{Path, PathBuf};

use reqwest::header::{ACCEPT, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::services::ai_skill_service::parse_skill_file;
use crate::state::ensure_app_fs_root;

const ATTACHMENT_DIRS: &[&str] = &["scripts", "references", "assets"];
const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_RAW_BASE: &str = "https://raw.githubusercontent.com";
const USER_AGENT_VALUE: &str = "Multi-Flow/skill-installer";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillRequest {
    pub source: String,
    pub source_type: Option<String>,
    pub slug_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillResult {
    pub slug: String,
    pub name: String,
    pub installed_path: String,
    pub enabled_for_session: bool,
    pub source_type: String,
    pub installed_files: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SkillInstallService {
    skills_root: PathBuf,
}

#[derive(Debug, Clone)]
struct GithubRepoRef {
    owner: String,
    repo: String,
    branch: Option<String>,
    subdir: Option<String>,
}

#[derive(Debug, Clone)]
enum SkillInstallSource {
    GithubRepo(GithubRepoRef),
    GithubFile {
        repo: GithubRepoRef,
        file_path: String,
    },
    DirectUrl(String),
}

#[derive(Debug, Clone)]
struct RemoteSkillPackage {
    source_type: String,
    skill_content: String,
    skill_dir: Option<String>,
    repo: Option<GithubRepoRef>,
    attachments: Vec<RemoteAttachment>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone)]
struct RemoteAttachment {
    rel_path: String,
    content: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct GithubRepoInfo {
    default_branch: String,
}

#[derive(Debug, Deserialize)]
struct GithubTreeResponse {
    tree: Vec<GithubTreeEntry>,
}

#[derive(Debug, Deserialize)]
struct GithubTreeEntry {
    path: String,
    #[serde(rename = "type")]
    kind: String,
}

impl SkillInstallService {
    pub fn new(app_fs_root: PathBuf) -> Self {
        Self {
            skills_root: app_fs_root.join(".agents").join("skills"),
        }
    }

    pub fn from_app(app: &tauri::AppHandle) -> AppResult<Self> {
        let fs_root = ensure_app_fs_root(app)?;
        Ok(Self::new(fs_root))
    }

    pub async fn install_from_source(
        &self,
        client: &Client,
        req: &InstallSkillRequest,
    ) -> AppResult<InstallSkillResult> {
        let source = req.source.trim();
        if source.is_empty() {
            return Err(AppError::Validation("安装来源不能为空".to_string()));
        }

        let source_kind = detect_source_type(source, req.source_type.as_deref())?;
        let package = match source_kind {
            SkillInstallSource::DirectUrl(url) => self.fetch_direct_url(client, &url).await?,
            SkillInstallSource::GithubFile { repo, file_path } => {
                self.fetch_github_file(client, &repo, &file_path).await?
            }
            SkillInstallSource::GithubRepo(repo) => {
                self.fetch_github_repo(client, &repo, req.slug_hint.as_deref())
                    .await?
            }
        };

        self.write_package(package, req)
    }

    fn write_package(
        &self,
        package: RemoteSkillPackage,
        req: &InstallSkillRequest,
    ) -> AppResult<InstallSkillResult> {
        fs::create_dir_all(&self.skills_root)?;

        let fallback_slug = req
            .slug_hint
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| {
                package
                    .skill_dir
                    .as_deref()
                    .and_then(|dir| Path::new(dir).file_name())
                    .and_then(|name| name.to_str())
                    .map(ToOwned::to_owned)
            })
            .or_else(|| package.repo.as_ref().map(|repo| repo.repo.clone()))
            .unwrap_or_else(|| "imported-skill".to_string());

        let parsed = parse_skill_file(&fallback_slug, &package.skill_content)?;
        let target_dir = self.skills_root.join(&parsed.meta.slug);
        if target_dir.exists() {
            return Err(AppError::Conflict(format!(
                "skill '{}' 已存在，当前版本不支持覆盖安装",
                parsed.meta.slug
            )));
        }

        fs::create_dir_all(&target_dir)?;
        let skill_path = target_dir.join("SKILL.md");
        fs::write(&skill_path, package.skill_content.as_bytes())?;

        let mut installed_files = vec![format!("{}/SKILL.md", parsed.meta.slug)];
        for attachment in package.attachments {
            let relative_path = attachment.rel_path.replace('\\', "/");
            if !is_allowed_attachment_path(&relative_path) {
                continue;
            }
            let target = target_dir.join(&relative_path);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&target, attachment.content)?;
            installed_files.push(format!("{}/{}", parsed.meta.slug, relative_path));
        }

        Ok(InstallSkillResult {
            slug: parsed.meta.slug,
            name: parsed.meta.name,
            installed_path: target_dir.display().to_string(),
            enabled_for_session: false,
            source_type: package.source_type,
            installed_files,
            warnings: package.warnings,
        })
    }

    async fn fetch_direct_url(&self, client: &Client, url: &str) -> AppResult<RemoteSkillPackage> {
        let content = fetch_text(client, url).await?;
        Ok(RemoteSkillPackage {
            source_type: "url".to_string(),
            skill_content: content,
            skill_dir: None,
            repo: None,
            attachments: vec![],
            warnings: vec![],
        })
    }

    async fn fetch_github_file(
        &self,
        client: &Client,
        repo: &GithubRepoRef,
        file_path: &str,
    ) -> AppResult<RemoteSkillPackage> {
        let branch = resolve_branch(client, repo).await?;
        let content = fetch_text(
            client,
            &github_raw_url(&repo.owner, &repo.repo, &branch, file_path),
        )
        .await?;
        let skill_dir = Path::new(file_path)
            .parent()
            .and_then(|path| path.to_str())
            .map(ToOwned::to_owned);
        let attachments = if let Some(ref dir) = skill_dir {
            fetch_github_attachments(client, repo, &branch, dir).await?
        } else {
            vec![]
        };

        Ok(RemoteSkillPackage {
            source_type: "url".to_string(),
            skill_content: content,
            skill_dir,
            repo: Some(GithubRepoRef {
                owner: repo.owner.clone(),
                repo: repo.repo.clone(),
                branch: Some(branch),
                subdir: repo.subdir.clone(),
            }),
            attachments,
            warnings: vec![],
        })
    }

    async fn fetch_github_repo(
        &self,
        client: &Client,
        repo: &GithubRepoRef,
        slug_hint: Option<&str>,
    ) -> AppResult<RemoteSkillPackage> {
        let branch = resolve_branch(client, repo).await?;
        let tree = fetch_github_tree(client, &repo.owner, &repo.repo, &branch).await?;
        let skill_dir = resolve_skill_dir(&tree, repo.subdir.as_deref(), slug_hint)?;
        let skill_path = if skill_dir.is_empty() {
            "SKILL.md".to_string()
        } else {
            format!("{skill_dir}/SKILL.md")
        };
        let content = fetch_text(
            client,
            &github_raw_url(&repo.owner, &repo.repo, &branch, &skill_path),
        )
        .await?;
        let attachments = fetch_github_attachments(client, repo, &branch, &skill_dir).await?;

        Ok(RemoteSkillPackage {
            source_type: "git".to_string(),
            skill_content: content,
            skill_dir: (!skill_dir.is_empty()).then_some(skill_dir),
            repo: Some(GithubRepoRef {
                owner: repo.owner.clone(),
                repo: repo.repo.clone(),
                branch: Some(branch),
                subdir: repo.subdir.clone(),
            }),
            attachments,
            warnings: vec![],
        })
    }
}

fn detect_source_type(
    source: &str,
    raw_source_type: Option<&str>,
) -> AppResult<SkillInstallSource> {
    let source_type = raw_source_type.unwrap_or("auto");
    match source_type {
        "auto" => auto_detect_source(source),
        "url" => parse_url_source(source),
        "git" => parse_git_source(source),
        _ => Err(AppError::Validation(format!(
            "不支持的 sourceType: {source_type}"
        ))),
    }
}

fn auto_detect_source(source: &str) -> AppResult<SkillInstallSource> {
    if source.starts_with("http://") || source.starts_with("https://") {
        return parse_url_source(source);
    }
    parse_git_source(source)
}

fn parse_url_source(source: &str) -> AppResult<SkillInstallSource> {
    let url = reqwest::Url::parse(source)
        .map_err(|_| AppError::Validation("安装来源不是合法 URL".to_string()))?;

    if let Some(repo) = parse_skills_sh_url(&url) {
        return Ok(SkillInstallSource::GithubRepo(repo));
    }
    if let Some((repo, file_path)) = parse_github_blob_like_url(&url) {
        return Ok(SkillInstallSource::GithubFile { repo, file_path });
    }
    if let Some(repo) = parse_github_repo_url(&url) {
        return Ok(SkillInstallSource::GithubRepo(repo));
    }

    if source.ends_with("SKILL.md") {
        return Ok(SkillInstallSource::DirectUrl(source.to_string()));
    }

    Err(AppError::Validation(
        "当前只支持 skills.sh、GitHub Skill 链接，或直接指向 SKILL.md 的 URL".to_string(),
    ))
}

fn parse_git_source(source: &str) -> AppResult<SkillInstallSource> {
    if source.contains("://") {
        return parse_url_source(source);
    }
    let normalized = source.trim_matches('/');
    let parts: Vec<_> = normalized
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();
    if parts.len() < 2 {
        return Err(AppError::Validation(
            "Git 来源格式应为 owner/repo 或 owner/repo/path".to_string(),
        ));
    }
    let repo = GithubRepoRef {
        owner: parts[0].to_string(),
        repo: parts[1].to_string(),
        branch: None,
        subdir: normalize_subdir(&parts[2..].join("/")),
    };
    Ok(SkillInstallSource::GithubRepo(repo))
}

fn parse_skills_sh_url(url: &reqwest::Url) -> Option<GithubRepoRef> {
    if url.domain()? != "skills.sh" {
        return None;
    }
    let parts: Vec<_> = url
        .path_segments()?
        .filter(|part| !part.is_empty())
        .collect();
    if parts.len() < 3 {
        return None;
    }
    Some(GithubRepoRef {
        owner: parts[0].to_string(),
        repo: parts[1].to_string(),
        branch: None,
        subdir: normalize_subdir(&format!("skills/{}", parts[2..].join("/"))),
    })
}

fn parse_github_repo_url(url: &reqwest::Url) -> Option<GithubRepoRef> {
    if url.domain()? != "github.com" {
        return None;
    }
    let parts: Vec<_> = url
        .path_segments()?
        .filter(|part| !part.is_empty())
        .collect();
    if parts.len() < 2 {
        return None;
    }
    if parts.get(2) == Some(&"blob") || parts.get(2) == Some(&"tree") {
        return None;
    }
    Some(GithubRepoRef {
        owner: parts[0].to_string(),
        repo: parts[1].to_string(),
        branch: None,
        subdir: normalize_subdir(&parts[2..].join("/")),
    })
}

fn parse_github_blob_like_url(url: &reqwest::Url) -> Option<(GithubRepoRef, String)> {
    let domain = url.domain()?;
    let parts: Vec<_> = url
        .path_segments()?
        .filter(|part| !part.is_empty())
        .collect();

    if domain == "raw.githubusercontent.com" {
        if parts.len() < 4 {
            return None;
        }
        let file_path = parts[3..].join("/");
        let repo = GithubRepoRef {
            owner: parts[0].to_string(),
            repo: parts[1].to_string(),
            branch: Some(parts[2].to_string()),
            subdir: Path::new(&file_path)
                .parent()
                .and_then(|path| path.to_str())
                .and_then(normalize_subdir),
        };
        return Some((repo, file_path));
    }

    if domain == "github.com" && parts.len() >= 5 {
        let view_kind = parts[2];
        if view_kind != "blob" && view_kind != "raw" {
            return None;
        }
        let branch = parts[3].to_string();
        let file_path = parts[4..].join("/");
        let repo = GithubRepoRef {
            owner: parts[0].to_string(),
            repo: parts[1].to_string(),
            branch: Some(branch),
            subdir: Path::new(&file_path)
                .parent()
                .and_then(|path| path.to_str())
                .and_then(normalize_subdir),
        };
        return Some((repo, file_path));
    }

    None
}

fn normalize_subdir(value: &str) -> Option<String> {
    let trimmed = value.trim_matches('/');
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn github_api<T: for<'de> Deserialize<'de>>(
    builder: reqwest::RequestBuilder,
) -> AppResult<T> {
    let response = builder.send().await?;
    if !response.status().is_success() {
        return Err(AppError::Validation(format!(
            "请求 GitHub 失败: HTTP {}",
            response.status()
        )));
    }
    response.json::<T>().await.map_err(AppError::from)
}

async fn fetch_text(client: &Client, url: &str) -> AppResult<String> {
    let response = client
        .get(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(AppError::Validation(format!(
            "下载 Skill 失败: HTTP {}",
            response.status()
        )));
    }
    response.text().await.map_err(AppError::from)
}

async fn fetch_bytes(client: &Client, url: &str) -> AppResult<Vec<u8>> {
    let response = client
        .get(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(AppError::Validation(format!(
            "下载附件失败: HTTP {}",
            response.status()
        )));
    }
    Ok(response.bytes().await?.to_vec())
}

async fn resolve_branch(client: &Client, repo: &GithubRepoRef) -> AppResult<String> {
    if let Some(branch) = repo.branch.clone() {
        return Ok(branch);
    }
    let info: GithubRepoInfo = github_api(
        client
            .get(format!(
                "{GITHUB_API_BASE}/repos/{}/{}",
                repo.owner, repo.repo
            ))
            .header(USER_AGENT, USER_AGENT_VALUE)
            .header(ACCEPT, "application/vnd.github+json"),
    )
    .await?;
    Ok(info.default_branch)
}

async fn fetch_github_tree(
    client: &Client,
    owner: &str,
    repo: &str,
    branch: &str,
) -> AppResult<Vec<GithubTreeEntry>> {
    let response: GithubTreeResponse = github_api(
        client
            .get(format!(
                "{GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
            ))
            .header(USER_AGENT, USER_AGENT_VALUE)
            .header(ACCEPT, "application/vnd.github+json"),
    )
    .await?;
    Ok(response.tree)
}

fn resolve_skill_dir(
    tree: &[GithubTreeEntry],
    subdir: Option<&str>,
    slug_hint: Option<&str>,
) -> AppResult<String> {
    let skill_paths: Vec<&str> = tree
        .iter()
        .filter(|entry| entry.kind == "blob" && entry.path.ends_with("SKILL.md"))
        .map(|entry| entry.path.as_str())
        .collect();

    if let Some(subdir) = subdir {
        let normalized = subdir.trim_matches('/');
        let skill_path = if normalized.is_empty() {
            "SKILL.md".to_string()
        } else {
            format!("{normalized}/SKILL.md")
        };
        if skill_paths.iter().any(|path| *path == skill_path) {
            return Ok(normalized.to_string());
        }
        return Err(AppError::NotFound(format!(
            "在仓库中未找到 Skill 文件: {skill_path}"
        )));
    }

    if skill_paths.contains(&"SKILL.md") {
        return Ok(String::new());
    }

    if let Some(slug_hint) = slug_hint {
        let expected = format!("{}/SKILL.md", slug_hint.trim_matches('/'));
        if skill_paths.iter().any(|path| *path == expected) {
            return Ok(slug_hint.trim_matches('/').to_string());
        }
    }

    if skill_paths.len() == 1 {
        let only = skill_paths[0];
        let parent = Path::new(only)
            .parent()
            .and_then(|path| path.to_str())
            .unwrap_or("");
        return Ok(parent.to_string());
    }

    if skill_paths.is_empty() {
        return Err(AppError::NotFound("仓库中没有找到 SKILL.md".to_string()));
    }

    Err(AppError::Validation(
        "仓库中存在多个 SKILL.md，请提供更具体的 Git 路径或 slugHint".to_string(),
    ))
}

async fn fetch_github_attachments(
    client: &Client,
    repo: &GithubRepoRef,
    branch: &str,
    skill_dir: &str,
) -> AppResult<Vec<RemoteAttachment>> {
    let tree = fetch_github_tree(client, &repo.owner, &repo.repo, branch).await?;
    let mut attachments = Vec::new();

    for subdir in ATTACHMENT_DIRS {
        let prefix = if skill_dir.is_empty() {
            format!("{subdir}/")
        } else {
            format!("{skill_dir}/{subdir}/")
        };
        let base_prefix = if skill_dir.is_empty() {
            String::new()
        } else {
            format!("{skill_dir}/")
        };
        for entry in tree
            .iter()
            .filter(|entry| entry.kind == "blob" && entry.path.starts_with(&prefix))
        {
            let relative = match entry.path.strip_prefix(&base_prefix) {
                Some(value) => value.to_string(),
                None => continue,
            };
            let bytes = fetch_bytes(
                client,
                &github_raw_url(&repo.owner, &repo.repo, branch, &entry.path),
            )
            .await?;
            attachments.push(RemoteAttachment {
                rel_path: relative,
                content: bytes,
            });
        }
    }

    Ok(attachments)
}

fn github_raw_url(owner: &str, repo: &str, branch: &str, path: &str) -> String {
    format!(
        "{GITHUB_RAW_BASE}/{owner}/{repo}/{branch}/{}",
        path.trim_start_matches('/')
    )
}

fn is_allowed_attachment_path(path: &str) -> bool {
    let normalized = path.trim_matches('/');
    ATTACHMENT_DIRS
        .iter()
        .any(|dir| normalized == *dir || normalized.starts_with(&format!("{dir}/")))
}

#[cfg(test)]
mod tests {
    use super::{
        detect_source_type, is_allowed_attachment_path, parse_github_blob_like_url,
        parse_skills_sh_url, resolve_skill_dir, GithubTreeEntry, InstallSkillRequest,
        RemoteAttachment, RemoteSkillPackage, SkillInstallService, SkillInstallSource,
    };
    use std::fs;

    #[test]
    fn parse_skills_sh_urls_into_github_repo_refs() {
        let url = reqwest::Url::parse("https://skills.sh/vercel-labs/skills/find-skills").unwrap();
        let parsed = parse_skills_sh_url(&url).expect("skills.sh parse");
        assert_eq!(parsed.owner, "vercel-labs");
        assert_eq!(parsed.repo, "skills");
        assert_eq!(parsed.subdir.as_deref(), Some("skills/find-skills"));
    }

    #[test]
    fn parse_github_raw_skill_file_url() {
        let url = reqwest::Url::parse(
            "https://raw.githubusercontent.com/acme/skills/main/find-skills/SKILL.md",
        )
        .unwrap();
        let (repo, file_path) = parse_github_blob_like_url(&url).expect("raw parse");
        assert_eq!(repo.owner, "acme");
        assert_eq!(repo.repo, "skills");
        assert_eq!(repo.branch.as_deref(), Some("main"));
        assert_eq!(file_path, "find-skills/SKILL.md");
    }

    #[test]
    fn detect_git_shortcut_source() {
        let parsed =
            detect_source_type("acme/skills/find-skills", Some("git")).expect("detect git");
        assert!(matches!(parsed, SkillInstallSource::GithubRepo(_)));
    }

    #[test]
    fn resolve_skill_dir_prefers_exact_subdir() {
        let tree = vec![
            GithubTreeEntry {
                path: "find-skills/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
            GithubTreeEntry {
                path: "another/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
        ];
        let dir = resolve_skill_dir(&tree, Some("find-skills"), None).expect("dir");
        assert_eq!(dir, "find-skills");
    }

    #[test]
    fn resolve_skill_dir_rejects_ambiguous_repo() {
        let tree = vec![
            GithubTreeEntry {
                path: "find-skills/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
            GithubTreeEntry {
                path: "another/SKILL.md".to_string(),
                kind: "blob".to_string(),
            },
        ];
        assert!(resolve_skill_dir(&tree, None, None).is_err());
    }

    #[test]
    fn allowed_attachment_path_only_accepts_top_level_whitelist_dirs() {
        assert!(is_allowed_attachment_path("scripts/helper.py"));
        assert!(is_allowed_attachment_path("references/guide.md"));
        assert!(is_allowed_attachment_path("scripts/nested/helper.py"));
        assert!(!is_allowed_attachment_path("notes/readme.md"));
    }

    #[test]
    fn new_service_uses_agents_skills_root() {
        let tmp = tempfile::TempDir::new().unwrap();
        let svc = SkillInstallService::new(tmp.path().to_path_buf());

        assert_eq!(svc.skills_root, tmp.path().join(".agents").join("skills"));
    }

    #[test]
    fn write_package_saves_into_agents_skills_root() {
        let tmp = tempfile::TempDir::new().unwrap();
        let svc = SkillInstallService::new(tmp.path().to_path_buf());

        let package = RemoteSkillPackage {
            source_type: "git".to_string(),
            skill_content: "---\nslug: installed-skill\nname: Installed Skill\n---\nbody"
                .to_string(),
            skill_dir: Some("installed-skill".to_string()),
            repo: None,
            attachments: vec![RemoteAttachment {
                rel_path: "scripts/helper.py".to_string(),
                content: b"print('ok')".to_vec(),
            }],
            warnings: vec![],
        };
        let req = InstallSkillRequest {
            source: "acme/repo".to_string(),
            source_type: Some("git".to_string()),
            slug_hint: None,
        };

        let result = svc.write_package(package, &req).unwrap();
        let skill_root = tmp
            .path()
            .join(".agents")
            .join("skills")
            .join("installed-skill");
        let skill_md = skill_root.join("SKILL.md");
        let helper = skill_root.join("scripts").join("helper.py");

        assert_eq!(result.installed_path, skill_root.display().to_string());
        assert!(skill_md.exists());
        assert!(helper.exists());
        assert_eq!(
            result.installed_files,
            vec![
                "installed-skill/SKILL.md".to_string(),
                "installed-skill/scripts/helper.py".to_string()
            ]
        );
        assert!(!result.enabled_for_session);
        assert!(fs::read_to_string(skill_md)
            .unwrap()
            .contains("Installed Skill"));
    }

    #[test]
    fn write_package_keeps_enabled_for_session_false() {
        let tmp = tempfile::TempDir::new().unwrap();
        let svc = SkillInstallService::new(tmp.path().to_path_buf());

        let package = RemoteSkillPackage {
            source_type: "git".to_string(),
            skill_content: "---\nslug: installed-skill\nname: Installed Skill\n---\nbody"
                .to_string(),
            skill_dir: Some("installed-skill".to_string()),
            repo: None,
            attachments: vec![],
            warnings: vec![],
        };
        let req = InstallSkillRequest {
            source: "acme/repo".to_string(),
            source_type: Some("git".to_string()),
            slug_hint: None,
        };

        let result = svc.write_package(package, &req).unwrap();

        assert!(!result.enabled_for_session);
    }
}
