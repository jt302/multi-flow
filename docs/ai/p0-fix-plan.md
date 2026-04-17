# P0 修复实施计划

> 本文档记录 Skills / File System / MCP 审计（2026-04-17）中 P0 级缺陷的具体修复方案，防止上下文压缩后丢失实施细节。

## 总览

| # | 模块 | 问题 | 复杂度 |
|---|---|---|---|
| P0-1 | Skills | `enabled_skill_slugs` 缺 `double_option`，清空无效 | 简单 |
| P0-2 | Skills | `load_skill_bodies` 不检查 `meta.enabled` | 简单 |
| P0-3 | File | `file_mkdir` / `file_write_folder_desc` 未在危险确认列表 | 简单 |
| P0-4 | MCP | OAuth URL 缺 `state` 参数（CSRF） | 中 |
| P0-5 | MCP | stdio 子进程 stderr 管道从不读（deadlock 风险） | 中 |
| P0-6 | MCP | 应用退出不调 `shutdown_all()`（子进程泄漏） | 中 |
| P0-7 | File | 6 个通用文件工具硬编码 `ensure_app_fs_root`，白名单完全不生效 | 较复杂 |
| P0-8 | MCP | env 变量 deny-list（防止 PATH/LD_PRELOAD 等被覆盖） | 简单 |
| P0-9 | MCP | OAuth / Bearer token 明文入库（keychain 迁移） | 较复杂 |

---

## P0-1 Skills `double_option` 修复

**问题**：`chat_service.rs:104` 的 `enabled_skill_slugs` 是普通 `Option<Vec<String>>`，前端传 `null` 时 serde 解析为 `None`（不修改），无法清空。

**修改**：

文件：`src-tauri/src/services/chat_service.rs`

```rust
// 修改前（第 104 行）：
pub enabled_skill_slugs: Option<Vec<String>>,

// 修改后：
#[serde(default, deserialize_with = "double_option")]
pub enabled_skill_slugs: Option<Option<Vec<String>>>,
```

同时修改 `update_session` 中消费该字段的逻辑（约第 225-233 行），从 `Option<Vec<String>>` 改为 `Option<Option<Vec<String>>>`：

```rust
// 找到 update_session 中处理 enabled_skill_slugs 的代码
// 原来：
if let Some(slugs) = req.enabled_skill_slugs {
    entity.enabled_skill_slugs = Set(serde_json::to_string(&slugs).unwrap_or_default());
}

// 改为：
if let Some(slugs_opt) = req.enabled_skill_slugs {
    let json = serde_json::to_string(&slugs_opt.unwrap_or_default()).unwrap_or_default();
    entity.enabled_skill_slugs = Set(json);
}
```

**前端无需改动**：`chat-header.tsx:171` 当前当 slugs 为空时传 `null`，改为 `double_option` 后前端传 `null` → 后端收到 `Some(None)` → 写入 `"[]"` 即可。但要确认前端传的是 `null` 还是 `[]`，如果传的是 `null` 则语义是"清空"，如果传 `[]` 则也能走 `Some(Some([]))` 写入空数组，两者都正确。

---

## P0-2 Skills `meta.enabled` 检查

**问题**：`ai_skill_service.rs:283-287` 的 `load_skill_bodies` 只按 slug 读取，不校验 `meta.enabled`。

**修改**：

文件：`src-tauri/src/services/ai_skill_service.rs`

```rust
// 修改 load_skill_bodies（第 283-287 行）：
pub fn load_skill_bodies(&self, slugs: &[String]) -> Vec<(String, String)> {
    slugs.iter().filter_map(|slug| {
        self.read_skill(slug).ok().and_then(|full| {
            // 仅加载 enabled=true 的 skill
            if full.meta.enabled {
                Some((full.meta.name, full.body))
            } else {
                None
            }
        })
    }).collect()
}
```

---

## P0-3 危险工具列表补全

**问题**：`mod.rs:170-226` 中 `file_mkdir` 和 `file_write_folder_desc` 没有在危险列表，是写操作却不弹确认。

**修改**：

文件：`src-tauri/src/services/ai_tools/mod.rs`

在 `tool_risk_level` 的危险分支（约 172-178 行）中补加：
```rust
"app_delete_profile" | "app_delete_proxy" | "app_delete_group" | "app_stop_profile"
| "app_update_device_preset" | "app_delete_device_preset" | "magic_set_closed"
| "magic_safe_quit" | "file_write" | "file_append" | "file_mkdir"
| "file_write_folder_desc" | "cdp_clear_storage"
| "cdp_delete_cookies" | "auto_delete_script" => {
    ToolRiskLevel::Dangerous
}
```

在 `all_dangerous_tool_names`（约 211-226 行）也补加：
```rust
"file_mkdir",
"file_write_folder_desc",
```

---

## P0-4 MCP OAuth `state` 参数

**问题**：`manager.rs:655-662` 构造的 auth URL 没有 `state` 参数，存在 CSRF 风险。

**修改**：

文件：`src-tauri/src/services/mcp/oauth.rs`

1. 在 `wait_for_oauth_callback` 中接受 `expected_state` 参数，校验回调中的 `state`：

```rust
pub async fn wait_for_oauth_callback(port: u16, expected_state: String) -> Result<String, String> {
    // ...
    let app = Router::new().route(
        "/callback",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let tx = tx_clone.clone();
            let expected = expected_state.clone();
            async move {
                // 校验 state
                if params.get("state").map(|s| s.as_str()) != Some(&expected) {
                    return "Authorization failed: state mismatch (possible CSRF).".to_string();
                }
                if let Some(code) = params.get("code") {
                    // ...
                }
                "Authorization complete. You can close this window.".to_string()
            }
        }),
    );
    // ...
}
```

文件：`src-tauri/src/services/mcp/manager.rs`

在 `start_oauth` 中生成 state 并传入：

```rust
// 生成随机 state（16 字节 hex）
use rand::Rng;
let state: String = rand::thread_rng()
    .sample_iter(rand::distributions::Alphanumeric)
    .take(32)
    .map(char::from)
    .collect();

let auth_url = format!(
    "{}?response_type=code&client_id={}&redirect_uri={}&code_challenge={}&code_challenge_method=S256&scope={}&state={}",
    config.auth_url,
    urlencoding::encode(&config.client_id),
    urlencoding::encode(&redirect_uri),
    urlencoding::encode(&challenge),
    urlencoding::encode(&scopes),
    urlencoding::encode(&state),
);

let code = super::oauth::wait_for_oauth_callback(port, state).await?;
```

---

## P0-5 MCP stdio stderr drain

**问题**：`manager.rs:382` 设置了 `stderr: Stdio::piped()` 但从不读取，long-running 子进程会因 buffer 满而 deadlock。

**修改**：

文件：`src-tauri/src/services/mcp/manager.rs`

在 `connect_stdio_and_fetch_tools` 中，spawn 子进程后立即起一个后台任务排空 stderr：

```rust
let mut child = tokio::process::Command::new(command)
    // ...（不变）

let stderr = child.stderr.take().ok_or("Failed to get child stderr")?;

// 后台 drain stderr → 写入日志
let server_name_for_log = server.name.clone();
tokio::spawn(async move {
    use tokio::io::{AsyncBufReadExt, BufReader};
    let mut lines = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        crate::logger::info("mcp_stderr", format!("[{}] {}", server_name_for_log, line));
    }
});
```

---

## P0-6 MCP 应用退出调用 shutdown_all

**问题**：`lib.rs` 没有在 Tauri `RunEvent::ExitRequested` / `Exit` 中调用 `mcp_manager.shutdown_all()`，所有 stdio 子进程在应用退出时泄漏。

**修改**：

文件：`src-tauri/src/lib.rs`

找到 `.run(|app_handle, event| { ... })` 的 run handler，在 `RunEvent::ExitRequested` 中异步 shutdown：

```rust
.run(|app_handle, event| {
    match event {
        tauri::RunEvent::ExitRequested { .. } => {
            let mcp_manager = app_handle.state::<crate::state::AppState>().mcp_manager.clone();
            let rt = tokio::runtime::Handle::current();
            rt.block_on(async {
                mcp_manager.shutdown_all().await;
            });
        }
        _ => {}
    }
})
```

若当前 `lib.rs` 没有 run handler，需要把 `.run(handle_run_event)` 改为闭包形式。

---

## P0-7 File tools 对齐 FsWorkspaceService（白名单生效）

**问题**：`file_tools.rs:50-53` 硬编码 `ensure_app_fs_root`，用户配置的白名单/自定义沙箱根对 AI 无效。

**方案**：给 6 个通用工具添加可选的 `root_id` 参数（默认 `"default"`），全部路由到 `FsWorkspaceService`。

### 步骤 1：给 `FsWorkspaceService` 添加 `read_file` / `write_file` / `append_file` / `exists` 方法

文件：`src-tauri/src/services/fs_workspace_service.rs`

```rust
pub const MAX_READ_SIZE: u64 = 10 * 1024 * 1024; // 10MB
pub const MAX_WRITE_SIZE: usize = 10 * 1024 * 1024; // 10MB

/// 读取文件内容
pub fn read_file(&self, root_id: &str, rel_path: &str) -> AppResult<String> {
    let (root_path, _) = self.get_root_base(root_id)?;
    let target = self.safe_join(&root_path, rel_path)?;
    let meta = fs::metadata(&target)
        .map_err(|e| AppError::Validation(format!("读取 '{}' 失败: {e}", rel_path)))?;
    if meta.len() > MAX_READ_SIZE {
        return Err(AppError::Validation(format!(
            "文件过大 ({} bytes，上限 {} bytes)", meta.len(), MAX_READ_SIZE
        )));
    }
    fs::read_to_string(&target)
        .map_err(|e| AppError::Validation(format!("读取 '{}' 失败: {e}", rel_path)))
}

/// 覆盖写入文件
pub fn write_file(&self, root_id: &str, rel_path: &str, content: &str) -> AppResult<()> {
    let (root_path, allow_write) = self.get_root_base(root_id)?;
    if !allow_write {
        return Err(AppError::Validation("该根目录为只读".to_string()));
    }
    if content.len() > MAX_WRITE_SIZE {
        return Err(AppError::Validation(format!(
            "内容过大 ({} bytes，上限 {} bytes)", content.len(), MAX_WRITE_SIZE
        )));
    }
    let target = self.safe_join(&root_path, rel_path)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&target, content)
        .map_err(|e| AppError::Validation(format!("写入 '{}' 失败: {e}", rel_path)))
}

/// 追加写入文件
pub fn append_file(&self, root_id: &str, rel_path: &str, content: &str) -> AppResult<()> {
    let (root_path, allow_write) = self.get_root_base(root_id)?;
    if !allow_write {
        return Err(AppError::Validation("该根目录为只读".to_string()));
    }
    if content.len() > MAX_WRITE_SIZE {
        return Err(AppError::Validation(format!(
            "追加内容过大 ({} bytes，上限 {} bytes)", content.len(), MAX_WRITE_SIZE
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

/// 检查路径是否存在
pub fn path_exists(&self, root_id: &str, rel_path: &str) -> AppResult<(bool, bool)> {
    let (root_path, _) = self.get_root_base(root_id)?;
    let target = self.safe_join(&root_path, rel_path)?;
    let exists = target.exists();
    let is_dir = target.is_dir();
    Ok((exists, is_dir))
}

/// 创建目录（alias 供 file_tools 调用）
pub fn mkdir(&self, root_id: &str, rel_path: &str) -> AppResult<()> {
    self.create_folder(root_id, rel_path)
}
```

### 步骤 2：重写 `file_tools.rs` 的 `execute` 函数

用 `root_id`（默认 `"default"`）+ `FsWorkspaceService` 替换 `execute_with_fs_root`：

```rust
pub async fn execute(name: &str, args: Value, ctx: &mut ToolContext<'_>) -> Result<ToolResult, String> {
    // workspace 专属工具（不变）
    match name {
        "file_list_roots" => { /* ...不变... */ }
        "file_read_folder_desc" => { /* ...不变... */ }
        "file_write_folder_desc" => { /* ...不变... */ }
        _ => {}
    }

    // 通用文件工具：通过 FsWorkspaceService（尊重白名单/自定义沙箱根）
    let root_id = args.get("root_id").and_then(|v| v.as_str()).unwrap_or("default");
    let svc = crate::services::fs_workspace_service::from_app(ctx.app)
        .map_err(|e| format!("文件系统服务初始化失败: {e}"))?;

    match name {
        "file_read" => {
            let path = require_str(&args, "path")?;
            svc.read_file(root_id, &path).map(ToolResult::text).map_err(|e| e.to_string())
        }
        "file_write" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            svc.write_file(root_id, &path, &content)
                .map(|_| ToolResult::text(format!("已写入 {} bytes 到 '{}'", content.len(), path)))
                .map_err(|e| e.to_string())
        }
        "file_append" => {
            let path = require_str(&args, "path")?;
            let content = require_str(&args, "content")?;
            svc.append_file(root_id, &path, &content)
                .map(|_| ToolResult::text(format!("已向 '{}' 追加 {} bytes", path, content.len())))
                .map_err(|e| e.to_string())
        }
        "file_list_dir" => {
            let path = require_str(&args, "path")?;
            svc.list_dir(root_id, &path)
                .map(|entries| ToolResult::text(serde_json::to_string(&entries).unwrap_or_default()))
                .map_err(|e| e.to_string())
        }
        "file_exists" => {
            let path = require_str(&args, "path")?;
            svc.path_exists(root_id, &path)
                .map(|(exists, is_dir)| ToolResult::text(json!({"exists": exists, "is_dir": is_dir, "is_file": exists && !is_dir}).to_string()))
                .map_err(|e| e.to_string())
        }
        "file_mkdir" => {
            let path = require_str(&args, "path")?;
            svc.mkdir(root_id, &path)
                .map(|_| ToolResult::text(format!("已创建目录 '{}'", path)))
                .map_err(|e| e.to_string())
        }
        _ => Err(format!("未知文件工具: '{name}'")),
    }
}
```

### 步骤 3：更新 JSONSchema（tool_defs.rs）

6 个工具的 schema 中添加可选的 `root_id` 参数：

```json
{
  "name": "root_id",
  "type": "string",
  "description": "根目录 ID，默认 'default'（AI 沙箱）。调用 file_list_roots 查看可用根。"
}
```

---

## P0-8 MCP env deny-list

**问题**：`manager.rs:374-379` 直接把用户填写的 `env_json` 全部注入子进程，攻击者可覆盖 `PATH`、`LD_PRELOAD`、`DYLD_INSERT_LIBRARIES` 等敏感变量。

**修改**：

文件：`src-tauri/src/services/mcp/manager.rs`

在 spawn 前过滤 deny-list：

```rust
const ENV_DENY_LIST: &[&str] = &[
    "PATH", "LD_PRELOAD", "LD_LIBRARY_PATH",
    "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH", "DYLD_FALLBACK_LIBRARY_PATH",
    "PYTHONPATH", "NODE_PATH", "RUBYLIB",
];

let env_map: HashMap<String, String> = serde_json::from_str(&server.env_json)
    .map_err(|e| format!("Invalid env_json: {e}"))?;

// 过滤高危环境变量
let safe_env: HashMap<String, String> = env_map.into_iter()
    .filter(|(k, _)| {
        let upper = k.to_uppercase();
        !ENV_DENY_LIST.iter().any(|deny| *deny == upper)
    })
    .collect();

let mut child = tokio::process::Command::new(command)
    .args(&args)
    .envs(&safe_env)  // 用 safe_env
    // ...
```

---

## P0-9 MCP Token 迁移到 OS Keychain

**问题**：`mcp_server.rs:18` 的 `oauth_tokens_json` 字段明文存储 access_token / refresh_token。

**方案**：引入 `keyring` crate（跨平台 OS keychain，macOS Keychain / Windows Credential Store / Linux Secret Service）。

### 步骤 1：添加依赖

`src-tauri/Cargo.toml`：
```toml
keyring = "3"
```

### 步骤 2：提取 token 存储工具函数

新文件或在 `oauth.rs` 末尾追加：

```rust
const KEYRING_SERVICE: &str = "io.multiflow.app.mcp";

pub fn save_tokens_to_keychain(server_id: &str, tokens_json: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, server_id)
        .map_err(|e| format!("Keychain entry error: {e}"))?;
    entry.set_password(tokens_json)
        .map_err(|e| format!("Keychain write error: {e}"))
}

pub fn load_tokens_from_keychain(server_id: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, server_id)
        .map_err(|e| format!("Keychain entry error: {e}"))?;
    match entry.get_password() {
        Ok(tokens) => Ok(Some(tokens)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keychain read error: {e}")),
    }
}

pub fn delete_tokens_from_keychain(server_id: &str) {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, server_id) {
        let _ = entry.delete_credential();
    }
}
```

### 步骤 3：替换 `save_oauth_tokens` 和 `get_effective_bearer_token`

`manager.rs:674`：
```rust
// 原来：self.save_oauth_tokens(server_id, &tokens_json).await?;
// 改为：
super::oauth::save_tokens_to_keychain(server_id, &tokens_json)?;
// DB 字段写入标记（不存 token 本体）
self.mark_oauth_token_stored(server_id).await?;
```

`manager.rs: get_effective_bearer_token`：
```rust
// 原来从 server.oauth_tokens_json 读
// 改为从 keychain 读
let tokens_json = super::oauth::load_tokens_from_keychain(&server.id)?
    .ok_or("No OAuth tokens in keychain. Please re-authorize.")?;
let tokens: OAuthTokens = serde_json::from_str(&tokens_json)...;
```

### 步骤 4：删除 server 时清除 keychain

`delete_server`（`manager.rs` 约第 230 行）：
```rust
super::oauth::delete_tokens_from_keychain(&server_id);
```

### 步骤 5：DB 字段语义变更

`oauth_tokens_json` 字段保留但改为只存 `{"stored_in_keychain": true, "expires_at": <timestamp>}`，便于前端显示 token 过期时间而不暴露 token 本体。不需要新迁移，只是写入逻辑变化。

---

## 实施顺序

建议按以下顺序实施（每项一个 commit）：

```
commit 1: P0-1 + P0-2  Skills double_option + enabled check
commit 2: P0-3         file_mkdir/write_folder_desc 进危险列表
commit 3: P0-8         MCP env deny-list
commit 4: P0-4 + P0-5 + P0-6  MCP OAuth state + stderr drain + exit hook
commit 5: P0-7         File tools root_id 对齐 FsWorkspaceService
commit 6: P0-9         MCP token keychain 迁移
```

每个 commit 后运行：
```bash
cargo check --manifest-path src-tauri/Cargo.toml
pnpm -s build
```

---

## 验收标准

- P0-1：创建 session → 勾 skill → 取消全部 → 重新打开 session，`enabled_skill_slugs` 应为 `[]`
- P0-2：全局 disable 某 skill → AI 发消息 → system prompt 不含该 skill body
- P0-3：让 AI 调 `file_mkdir` → 弹确认弹窗
- P0-4：OAuth URL 含 `state=<32char>` 参数；callback 中 state 不匹配时返回错误
- P0-5：启动 stdio MCP server → 运行 >5 分钟 → 子进程不 deadlock
- P0-6：关闭应用 → `ps` 中无残留 MCP 子进程
- P0-7：在设置中添加白名单目录 → AI 调 `file_list_roots` 看到该目录 → 调 `file_read` with `root_id=<id>` 能读取
- P0-8：在 env_json 中设置 `PATH=/evil` → spawn 时该 env 被过滤掉
- P0-9：完成 OAuth → SQLite 中 `oauth_tokens_json` 无 access_token 明文；系统 Keychain 中存在对应条目
