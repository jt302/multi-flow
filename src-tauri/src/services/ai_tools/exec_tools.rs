use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{Emitter, Manager};

use crate::models::RunLogEntry;
use crate::services::app_preference_service::AppPreferenceService;

use super::{dialog_tools, ToolContext, ToolResult};

const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const VERSION_TIMEOUT_MS: u64 = 2_000;
const MAX_OUTPUT_CHARS: usize = 12_000;
const MAX_STDERR_CHARS: usize = 6_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecCommandRequest {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    timeout_ms: Option<u64>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
    #[serde(default)]
    output_mode: Option<String>,
    #[serde(default = "default_check_runtime")]
    check_runtime: bool,
    #[serde(default)]
    require_confirmation: bool,
}

fn default_check_runtime() -> bool {
    true
}

#[derive(Debug, Clone)]
struct RuntimeProbe {
    available: bool,
    resolved_path: Option<PathBuf>,
    version: Option<String>,
}

#[derive(Debug, Clone)]
enum RiskDecision {
    Allow { reason: String },
    Confirm { reason: String },
    Deny { reason: String },
}

pub async fn execute(args: Value, ctx: &mut ToolContext<'_>) -> Result<ToolResult, String> {
    let req: ExecCommandRequest =
        serde_json::from_value(args).map_err(|e| format!("exec_command args parse error: {e}"))?;

    validate_command_name(&req.command)?;

    let cwd = resolve_cwd(ctx.app, req.cwd.as_deref())?;
    let env_map = sanitize_env(req.env.clone().unwrap_or_default())?;
    let output_mode = req.output_mode.as_deref().unwrap_or("combined");
    if output_mode != "stdout" && output_mode != "combined" {
        return Err("output_mode must be 'stdout' or 'combined'".to_string());
    }

    let runtime = if req.check_runtime {
        probe_runtime(&req.command).await
    } else {
        RuntimeProbe {
            available: false,
            resolved_path: None,
            version: None,
        }
    };

    if req.check_runtime && !runtime.available {
        let install_suggestion = build_install_suggestion(&req.command);
        let locale = app_locale(ctx.app);
        let _ = emit_missing_runtime_dialog(ctx, &req.command, &cwd, &install_suggestion, &locale)
            .await;
        push_exec_log(
            ctx,
            "warn",
            format!("exec runtime missing: {}", req.command),
            Some(json!({
                "command": req.command,
                "cwd": cwd.display().to_string(),
                "suggestion": install_suggestion,
            })),
        );
        return Ok(ToolResult::text(
            serde_json::to_string(&json!({
                "status": "missing_runtime",
                "command": req.command,
                "args": req.args,
                "cwd": cwd.display().to_string(),
                "runtime": {
                    "available": false,
                    "version": serde_json::Value::Null,
                },
                "installSuggestion": install_suggestion,
            }))
            .unwrap_or_default(),
        ));
    }

    let risk = classify_risk(&req.command, &req.args, req.require_confirmation);
    match &risk {
        RiskDecision::Deny { reason } => {
            push_exec_log(
                ctx,
                "warn",
                format!("exec command denied: {}", req.command),
                Some(json!({
                    "command": req.command,
                    "args": req.args,
                    "cwd": cwd.display().to_string(),
                    "reason": reason,
                })),
            );
            return Ok(ToolResult::text(
                serde_json::to_string(&json!({
                    "status": "denied",
                    "command": req.command,
                    "args": req.args,
                    "cwd": cwd.display().to_string(),
                    "riskReason": reason,
                    "runtime": runtime_to_json(&runtime),
                }))
                .unwrap_or_default(),
            ));
        }
        RiskDecision::Confirm { reason } => {
            let confirmed = request_exec_confirmation(ctx, &req, &cwd, reason).await?;
            if !confirmed {
                return Ok(ToolResult::text(
                    serde_json::to_string(&json!({
                        "status": "cancelled",
                        "command": req.command,
                        "args": req.args,
                        "cwd": cwd.display().to_string(),
                        "riskReason": reason,
                        "runtime": runtime_to_json(&runtime),
                    }))
                    .unwrap_or_default(),
                ));
            }
        }
        RiskDecision::Allow { reason } => {
            push_exec_log(
                ctx,
                "debug",
                format!("exec command allowed: {}", req.command),
                Some(json!({
                    "command": req.command,
                    "args": req.args,
                    "cwd": cwd.display().to_string(),
                    "reason": reason,
                })),
            );
        }
    }

    let started_at = Instant::now();
    let resolved_path = runtime
        .resolved_path
        .clone()
        .unwrap_or_else(|| PathBuf::from(&req.command));
    let mut command = tokio::process::Command::new(&resolved_path);
    command
        .args(&req.args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if !env_map.is_empty() {
        command.envs(&env_map);
    }

    let output = match tokio::time::timeout(
        Duration::from_millis(req.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS)),
        command.output(),
    )
    .await
    {
        Ok(Ok(output)) => output,
        Ok(Err(err)) => {
            if err.kind() == std::io::ErrorKind::NotFound {
                let install_suggestion = build_install_suggestion(&req.command);
                return Ok(ToolResult::text(
                    serde_json::to_string(&json!({
                        "status": "missing_runtime",
                        "command": req.command,
                        "args": req.args,
                        "cwd": cwd.display().to_string(),
                        "runtime": {
                            "available": false,
                            "version": runtime.version,
                        },
                        "installSuggestion": install_suggestion,
                    }))
                    .unwrap_or_default(),
                ));
            }
            return Ok(ToolResult::text(
                serde_json::to_string(&json!({
                    "status": "failed",
                    "command": req.command,
                    "args": req.args,
                    "cwd": cwd.display().to_string(),
                    "error": format!("failed to spawn command: {err}"),
                    "runtime": runtime_to_json(&runtime),
                }))
                .unwrap_or_default(),
            ));
        }
        Err(_) => {
            return Ok(ToolResult::text(
                serde_json::to_string(&json!({
                    "status": "timed_out",
                    "command": req.command,
                    "args": req.args,
                    "cwd": cwd.display().to_string(),
                    "timeoutMs": req.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
                    "runtime": runtime_to_json(&runtime),
                }))
                .unwrap_or_default(),
            ));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.is_empty() {
        stdout.clone()
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };
    let primary_output = if output_mode == "stdout" {
        stdout.clone()
    } else {
        combined.clone()
    };
    let elapsed_ms = started_at.elapsed().as_millis() as u64;
    let (output_text, output_truncated) = truncate_text(&primary_output, MAX_OUTPUT_CHARS);
    let (stderr_text, stderr_truncated) = truncate_text(&stderr, MAX_STDERR_CHARS);

    push_exec_log(
        ctx,
        if output.status.success() {
            "info"
        } else {
            "warn"
        },
        format!("exec command finished: {}", req.command),
        Some(json!({
            "command": req.command,
            "args": req.args,
            "cwd": cwd.display().to_string(),
            "exitCode": output.status.code(),
            "elapsedMs": elapsed_ms,
            "runtime": runtime_to_json(&runtime),
        })),
    );

    Ok(ToolResult::text(
        serde_json::to_string(&json!({
            "status": if output.status.success() { "completed" } else { "failed" },
            "command": req.command,
            "args": req.args,
            "cwd": cwd.display().to_string(),
            "exitCode": output.status.code(),
            "elapsedMs": elapsed_ms,
            "outputMode": output_mode,
            "output": output_text,
            "stderr": stderr_text,
            "outputTruncated": output_truncated,
            "stderrTruncated": stderr_truncated,
            "runtime": runtime_to_json(&runtime),
        }))
        .unwrap_or_default(),
    ))
}

fn validate_command_name(command: &str) -> Result<(), String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("command is required".to_string());
    }
    if trimmed.contains(char::is_whitespace) {
        return Err("command must be a single executable name".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("command must not contain path separators".to_string());
    }
    Ok(())
}

fn resolve_cwd(app: &tauri::AppHandle, raw_cwd: Option<&str>) -> Result<PathBuf, String> {
    let pref_svc = AppPreferenceService::from_app_handle(app).map_err(|e| e.to_string())?;
    let root = if let Some(custom) = pref_svc.get_fs_sandbox_root().map_err(|e| e.to_string())? {
        PathBuf::from(custom)
    } else {
        crate::state::ensure_app_fs_root(app).map_err(|e| e.to_string())?
    };

    resolve_cwd_in_root(&root, raw_cwd)
}

fn resolve_cwd_in_root(root: &Path, raw_cwd: Option<&str>) -> Result<PathBuf, String> {
    let resolved = match raw_cwd.map(str::trim).filter(|value| !value.is_empty()) {
        None => root.to_path_buf(),
        Some(value) => {
            let candidate = PathBuf::from(value);
            if candidate.is_absolute() {
                candidate
            } else {
                root.join(candidate)
            }
        }
    };

    let normalized = resolved
        .canonicalize()
        .or_else(|_| {
            if resolved.exists() {
                Ok(resolved.clone())
            } else {
                std::fs::create_dir_all(&resolved)?;
                resolved.canonicalize()
            }
        })
        .map_err(|e| format!("failed to resolve cwd: {e}"))?;
    let normalized_root = root.canonicalize().unwrap_or(root.to_path_buf());

    if !normalized.starts_with(&normalized_root) {
        return Err(format!(
            "cwd must stay inside the current workspace root: {}",
            normalized_root.display()
        ));
    }

    Ok(normalized)
}

fn sanitize_env(env_map: HashMap<String, String>) -> Result<HashMap<String, String>, String> {
    let mut safe = HashMap::new();
    for (key, value) in env_map {
        if !is_allowed_env_key(&key) {
            return Err(format!("environment variable '{key}' is not allowed"));
        }
        safe.insert(key, value);
    }
    Ok(safe)
}

fn is_allowed_env_key(key: &str) -> bool {
    if key.is_empty()
        || !key
            .chars()
            .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_')
    {
        return false;
    }
    let deny_exact = [
        "PATH",
        "HOME",
        "SHELL",
        "PWD",
        "OLDPWD",
        "TMPDIR",
        "USER",
        "LOGNAME",
        "NODE_OPTIONS",
        "RUSTC_WRAPPER",
        "DYLD_INSERT_LIBRARIES",
        "DYLD_LIBRARY_PATH",
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
    ];
    if deny_exact.contains(&key) {
        return false;
    }
    !key.starts_with("DYLD_") && !key.starts_with("LD_")
}

async fn probe_runtime(command: &str) -> RuntimeProbe {
    let resolved_path = find_command_in_path(command);
    if let Some(path) = resolved_path.clone() {
        let version = detect_version(&path).await;
        RuntimeProbe {
            available: true,
            resolved_path: Some(path),
            version,
        }
    } else {
        RuntimeProbe {
            available: false,
            resolved_path: None,
            version: None,
        }
    }
}

fn find_command_in_path(command: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    find_command_in_path_var(command, &path_var)
}

fn find_command_in_path_var(command: &str, path_var: &std::ffi::OsStr) -> Option<PathBuf> {
    #[cfg(windows)]
    let exts: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string())
        .split(';')
        .map(|ext| ext.trim().to_string())
        .collect();

    for dir in std::env::split_paths(path_var) {
        let candidate = dir.join(command);
        if candidate.is_file() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            for ext in &exts {
                let with_ext = dir.join(format!("{command}{ext}"));
                if with_ext.is_file() {
                    return Some(with_ext);
                }
            }
        }
    }
    None
}

async fn detect_version(path: &Path) -> Option<String> {
    let attempts = [vec!["--version"], vec!["-V"], vec!["-v"], vec!["version"]];

    for flags in attempts {
        let mut command = tokio::process::Command::new(path);
        command
            .args(flags.iter())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        if let Ok(Ok(output)) =
            tokio::time::timeout(Duration::from_millis(VERSION_TIMEOUT_MS), command.output()).await
        {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let text = if !stdout.is_empty() { stdout } else { stderr };
            if !text.is_empty() {
                return text
                    .lines()
                    .find(|line| !line.trim().is_empty())
                    .map(|line| line.trim().to_string());
            }
        }
    }
    None
}

fn build_install_suggestion(command: &str) -> String {
    match command {
        "node" | "npm" | "npx" => "Install Node.js so npm and npx are available.".to_string(),
        "pnpm" => "Install pnpm globally, for example: npm install -g pnpm".to_string(),
        "bun" => "Install Bun from https://bun.sh/ or your package manager.".to_string(),
        "uv" => "Install uv from https://docs.astral.sh/uv/ or your package manager.".to_string(),
        "python" | "python3" => {
            "Install Python 3 and ensure the executable is on PATH.".to_string()
        }
        "pip" | "pip3" => "Install Python 3 with pip and ensure pip is on PATH.".to_string(),
        _ => format!("Install '{command}' and ensure it is available on PATH."),
    }
}

fn classify_risk(command: &str, args: &[String], require_confirmation: bool) -> RiskDecision {
    if require_confirmation {
        return RiskDecision::Confirm {
            reason: "AI requested manual confirmation before running this command".to_string(),
        };
    }

    let first = args.first().map(String::as_str).unwrap_or_default();

    let deny_exact = [
        "sudo",
        "su",
        "doas",
        "launchctl",
        "systemctl",
        "shutdown",
        "reboot",
        "halt",
        "poweroff",
        "mkfs",
        "fdisk",
        "diskutil",
        "dd",
    ];
    if deny_exact.contains(&command) {
        return RiskDecision::Deny {
            reason: "This command can change system state outside the workspace".to_string(),
        };
    }

    if matches!(
        command,
        "sh" | "bash" | "zsh" | "fish" | "cmd" | "powershell" | "pwsh"
    ) && matches!(first, "-c" | "-lc" | "/c" | "/k")
    {
        return RiskDecision::Deny {
            reason: "Inline shell execution is blocked for exec_command".to_string(),
        };
    }

    if command == "rm"
        && args
            .iter()
            .any(|arg| arg == "-rf" || arg == "-fr" || arg == "--recursive" || arg == "--force")
    {
        return RiskDecision::Deny {
            reason: "Recursive forced delete is blocked".to_string(),
        };
    }

    if command == "git" {
        return match first {
            "status" | "diff" | "show" | "log" | "rev-parse" | "ls-files" | "branch" => {
                RiskDecision::Allow {
                    reason: "Read-only git inspection command".to_string(),
                }
            }
            "" => RiskDecision::Confirm {
                reason: "Git command may modify repository state".to_string(),
            },
            _ => RiskDecision::Confirm {
                reason: "Git write operation requires confirmation".to_string(),
            },
        };
    }

    if is_package_manager_mutation(command, args) {
        return RiskDecision::Confirm {
            reason: "Dependency installation or package mutation requires confirmation".to_string(),
        };
    }

    if matches!(command, "curl" | "wget") {
        return RiskDecision::Confirm {
            reason: "Network download commands require confirmation".to_string(),
        };
    }

    if is_interpreter_execution(command, args) {
        return RiskDecision::Confirm {
            reason: "Interpreter-driven code execution requires confirmation".to_string(),
        };
    }

    if command == "npx"
        && args.first().map(String::as_str) == Some("skills")
        && args.get(1).map(String::as_str) == Some("find")
    {
        return RiskDecision::Allow {
            reason: "Recognized read-only skills lookup".to_string(),
        };
    }

    if matches!(
        command,
        "pwd"
            | "ls"
            | "cat"
            | "rg"
            | "find"
            | "which"
            | "whereis"
            | "echo"
            | "uname"
            | "whoami"
            | "env"
    ) {
        return RiskDecision::Allow {
            reason: "Read-only query command".to_string(),
        };
    }

    RiskDecision::Confirm {
        reason: "Unknown command requires manual confirmation by default".to_string(),
    }
}

fn is_package_manager_mutation(command: &str, args: &[String]) -> bool {
    let first = args.first().map(String::as_str).unwrap_or_default();
    match command {
        "npm" | "pnpm" | "yarn" | "bun" => matches!(
            first,
            "install"
                | "i"
                | "add"
                | "remove"
                | "rm"
                | "uninstall"
                | "update"
                | "up"
                | "link"
                | "unlink"
        ),
        "uv" => matches!(
            args.iter()
                .map(String::as_str)
                .collect::<Vec<_>>()
                .as_slice(),
            ["pip", "install", ..]
                | ["pip", "sync", ..]
                | ["tool", "install", ..]
                | ["add", ..]
                | ["remove", ..]
                | ["sync", ..]
        ),
        "pip" | "pip3" => matches!(first, "install" | "uninstall"),
        "cargo" => matches!(first, "add" | "install" | "uninstall" | "update"),
        "brew" => matches!(first, "install" | "uninstall" | "upgrade"),
        _ => false,
    }
}

fn is_interpreter_execution(command: &str, args: &[String]) -> bool {
    if !matches!(
        command,
        "python" | "python3" | "node" | "bun" | "ruby" | "perl" | "php"
    ) {
        return false;
    }
    let first = args.first().map(String::as_str).unwrap_or_default();
    !first.is_empty() && !first.starts_with('-')
}

async fn request_exec_confirmation(
    ctx: &mut ToolContext<'_>,
    req: &ExecCommandRequest,
    cwd: &Path,
    reason: &str,
) -> Result<bool, String> {
    let request_id = format!("tool-confirm-{}", uuid::Uuid::new_v4());
    let (tx, rx) = tokio::sync::oneshot::channel::<bool>();
    {
        let state = ctx.app.state::<crate::state::AppState>();
        let mut channels = state
            .tool_confirmation_channels
            .lock()
            .map_err(|_| "tool_confirmation_channels lock poisoned".to_string())?;
        channels.insert(request_id.clone(), tx);
    }

    let payload = json!({
        "requestId": request_id,
        "toolName": "exec_command",
        "args": {
            "command": req.command,
            "args": req.args,
        },
        "riskLevel": "dangerous",
        "cwd": cwd.display().to_string(),
        "riskReason": reason,
    });
    ctx.app
        .emit_to("main", "tool-confirmation-request", &payload)
        .map_err(|e| format!("Failed to emit tool-confirmation-request: {e}"))?;

    tokio::time::timeout(Duration::from_secs(60), rx)
        .await
        .map_err(|_| "Tool confirmation timed out (60s)".to_string())?
        .map_err(|_| "Tool confirmation channel closed unexpectedly".to_string())
}

async fn emit_missing_runtime_dialog(
    ctx: &mut ToolContext<'_>,
    command: &str,
    cwd: &Path,
    install_suggestion: &str,
    locale: &str,
) -> Result<(), String> {
    let (title, message) = if locale.starts_with("en") {
        (
            format!("Command '{command}' is not installed"),
            format!(
                "The AI cannot run `{command}` because it is not available on PATH.\n\nWorkspace: `{}`\n\nSuggestion: {}",
                cwd.display(),
                install_suggestion
            ),
        )
    } else {
        (
            format!("命令 `{command}` 未安装"),
            format!(
                "AI 无法执行 `{command}`，因为当前系统 PATH 中找不到它。\n\n工作目录：`{}`\n\n建议：{}",
                cwd.display(),
                install_suggestion
            ),
        )
    };
    let _ = dialog_tools::execute(
        "dialog_message",
        json!({
            "title": title,
            "message": message,
            "level": "warning",
        }),
        ctx,
    )
    .await?;
    Ok(())
}

fn app_locale(app: &tauri::AppHandle) -> String {
    AppPreferenceService::from_app_handle(app)
        .ok()
        .and_then(|svc| svc.read_app_language().ok().flatten())
        .unwrap_or_else(|| "zh-CN".to_string())
}

fn truncate_text(input: &str, max_chars: usize) -> (String, bool) {
    let chars: Vec<char> = input.chars().collect();
    if chars.len() <= max_chars {
        return (input.to_string(), false);
    }
    (chars.into_iter().take(max_chars).collect::<String>(), true)
}

fn runtime_to_json(runtime: &RuntimeProbe) -> Value {
    json!({
        "available": runtime.available,
        "resolvedPath": runtime.resolved_path.as_ref().map(|path| path.display().to_string()),
        "version": runtime.version,
    })
}

fn push_exec_log(ctx: &mut ToolContext<'_>, level: &str, message: String, details: Option<Value>) {
    ctx.logs.push(RunLogEntry {
        timestamp: chrono::Utc::now().timestamp_millis(),
        level: level.to_string(),
        category: "ai".to_string(),
        message,
        details,
        profile_id: ctx.current_profile_id.map(str::to_string),
        profile_name: None,
    });
}

#[cfg(test)]
mod tests {
    use super::{
        build_install_suggestion, classify_risk, find_command_in_path_var, is_allowed_env_key,
        resolve_cwd_in_root, RiskDecision,
    };

    #[test]
    fn exec_risk_classifier_allows_skills_lookup() {
        let risk = classify_risk(
            "npx",
            &["skills".into(), "find".into(), "react".into()],
            false,
        );
        assert!(matches!(risk, RiskDecision::Allow { .. }));
    }

    #[test]
    fn exec_risk_classifier_requires_confirmation_for_package_install() {
        let risk = classify_risk("pnpm", &["add".into(), "zod".into()], false);
        assert!(matches!(risk, RiskDecision::Confirm { .. }));
    }

    #[test]
    fn exec_risk_classifier_denies_recursive_force_delete() {
        let risk = classify_risk("rm", &["-rf".into(), "/".into()], false);
        assert!(matches!(risk, RiskDecision::Deny { .. }));
    }

    #[test]
    fn exec_env_allowlist_blocks_path_override() {
        assert!(!is_allowed_env_key("PATH"));
        assert!(is_allowed_env_key("OPENAI_API_KEY"));
    }

    #[test]
    fn exec_path_lookup_finds_binary_in_custom_path() {
        let temp = tempfile::tempdir().expect("tempdir");
        let bin_path = temp.path().join("demo");
        std::fs::write(&bin_path, "#!/bin/sh\n").expect("write binary");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&bin_path)
                .expect("metadata")
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&bin_path, perms).expect("chmod");
        }

        let path_var = std::env::join_paths([temp.path()]).expect("join path");
        let found = find_command_in_path_var("demo", path_var.as_os_str()).expect("find path");
        assert_eq!(found, bin_path);
    }

    #[test]
    fn install_suggestion_covers_common_runtimes() {
        assert!(build_install_suggestion("npx").contains("Node.js"));
        assert!(build_install_suggestion("uv").contains("uv"));
    }

    #[test]
    fn resolve_cwd_stays_inside_workspace_root() {
        let root = tempfile::tempdir().expect("tempdir");
        let normalized_root = root.path().canonicalize().expect("canonicalize root");

        let inside = resolve_cwd_in_root(root.path(), Some("nested")).expect("inside cwd");
        assert!(inside.starts_with(&normalized_root));

        let outside = resolve_cwd_in_root(root.path(), Some("/tmp"));
        assert!(outside.is_err());
    }
}
