//! MCP 服务器连接管理器
//! 维护所有 MCP 服务器的生命周期、工具缓存和状态

use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::Mutex;

use crate::db::entities::mcp_server;
use crate::error::AppError;
use super::oauth::{OAuthConfig, OAuthTokens};
use super::transport::{HttpTransport, StdioTransport};

// ─── 公共 DTO ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerDto {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub command: Option<String>,
    pub args_json: String,
    pub env_json: String,
    pub url: Option<String>,
    pub headers_json: String,
    pub auth_type: String,
    pub bearer_token: Option<String>,
    pub oauth_config_json: Option<String>,
    pub oauth_tokens_json: Option<String>,
    pub enabled: bool,
    pub last_status: String,
    pub last_error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<mcp_server::Model> for McpServerDto {
    fn from(m: mcp_server::Model) -> Self {
        Self {
            id: m.id,
            name: m.name,
            transport: m.transport,
            command: m.command,
            args_json: m.args_json,
            env_json: m.env_json,
            url: m.url,
            headers_json: m.headers_json,
            auth_type: m.auth_type,
            bearer_token: m.bearer_token,
            oauth_config_json: m.oauth_config_json,
            oauth_tokens_json: m.oauth_tokens_json,
            enabled: m.enabled != 0,
            last_status: m.last_status,
            last_error: m.last_error,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolDef {
    pub server_id: String,
    pub server_name: String,
    /// 完整名称：mcp__<slug>__<tool>
    pub name: String,
    /// MCP server 原始工具名
    pub original_name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum McpServerStatus {
    Idle,
    Starting,
    Running,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMcpServerRequest {
    pub name: String,
    pub transport: String,
    pub command: Option<String>,
    pub args_json: Option<String>,
    pub env_json: Option<String>,
    pub url: Option<String>,
    pub headers_json: Option<String>,
    pub auth_type: Option<String>,
    pub bearer_token: Option<String>,
    pub oauth_config_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpServerRequest {
    pub name: Option<String>,
    pub transport: Option<String>,
    pub command: Option<String>,
    pub args_json: Option<String>,
    pub env_json: Option<String>,
    pub url: Option<String>,
    pub headers_json: Option<String>,
    pub auth_type: Option<String>,
    pub bearer_token: Option<String>,
    pub oauth_config_json: Option<String>,
}

// ─── 运行态连接 ──────────────────────────────────────────────────────────

/// 每个 MCP 服务器的运行态（工具缓存 + 连接）
struct McpServerRuntime {
    cached_tools: Vec<McpToolDef>,
    status: McpServerStatus,
    transport: McpRuntimeTransport,
}

enum McpRuntimeTransport {
    None,
    Stdio {
        child: tokio::process::Child,
        transport: StdioTransport,
    },
    Http(HttpTransport),
}

// ─── McpManager ──────────────────────────────────────────────────────────

pub struct McpManager {
    db: DatabaseConnection,
    /// server_id → 运行态连接（tokio Mutex 允许跨 await）
    runtimes: Mutex<HashMap<String, McpServerRuntime>>,
}

impl McpManager {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self {
            db,
            runtimes: Mutex::new(HashMap::new()),
        }
    }

    // ─── CRUD ─────────────────────────────────────────────────────────

    pub async fn list_servers(&self) -> Result<Vec<McpServerDto>, AppError> {
        let servers = mcp_server::Entity::find().all(&self.db).await?;
        Ok(servers.into_iter().map(McpServerDto::from).collect())
    }

    pub async fn get_server(&self, id: &str) -> Result<McpServerDto, AppError> {
        let server = mcp_server::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("MCP server '{id}' not found")))?;
        Ok(McpServerDto::from(server))
    }

    pub async fn create_server(
        &self,
        req: CreateMcpServerRequest,
    ) -> Result<McpServerDto, AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let model = mcp_server::ActiveModel {
            id: Set(id),
            name: Set(req.name),
            transport: Set(req.transport),
            command: Set(req.command),
            args_json: Set(req.args_json.unwrap_or_else(|| "[]".to_string())),
            env_json: Set(req.env_json.unwrap_or_else(|| "{}".to_string())),
            url: Set(req.url),
            headers_json: Set(req.headers_json.unwrap_or_else(|| "{}".to_string())),
            auth_type: Set(req.auth_type.unwrap_or_else(|| "none".to_string())),
            bearer_token: Set(req.bearer_token),
            oauth_config_json: Set(req.oauth_config_json),
            oauth_tokens_json: Set(None),
            enabled: Set(0),
            last_status: Set("idle".to_string()),
            last_error: Set(None),
            created_at: Set(now.clone()),
            updated_at: Set(now),
        };
        let inserted = model.insert(&self.db).await?;
        Ok(McpServerDto::from(inserted))
    }

    pub async fn update_server(
        &self,
        id: &str,
        req: UpdateMcpServerRequest,
    ) -> Result<McpServerDto, AppError> {
        let model = mcp_server::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("MCP server '{id}' not found")))?;

        let now = chrono::Utc::now().to_rfc3339();
        let mut active: mcp_server::ActiveModel = model.into();
        if let Some(name) = req.name {
            active.name = Set(name);
        }
        if let Some(transport) = req.transport {
            active.transport = Set(transport);
        }
        if let Some(command) = req.command {
            active.command = Set(Some(command));
        }
        if let Some(args_json) = req.args_json {
            active.args_json = Set(args_json);
        }
        if let Some(env_json) = req.env_json {
            active.env_json = Set(env_json);
        }
        if let Some(url) = req.url {
            active.url = Set(Some(url));
        }
        if let Some(headers_json) = req.headers_json {
            active.headers_json = Set(headers_json);
        }
        if let Some(auth_type) = req.auth_type {
            active.auth_type = Set(auth_type);
        }
        if let Some(bearer_token) = req.bearer_token {
            active.bearer_token = Set(Some(bearer_token));
        }
        if let Some(oauth_config_json) = req.oauth_config_json {
            active.oauth_config_json = Set(Some(oauth_config_json));
        }
        active.updated_at = Set(now);

        let updated = active.update(&self.db).await?;
        // 重置连接（配置变更后需要重新连接）
        let mut runtimes = self.runtimes.lock().await;
        runtimes.remove(id);
        Ok(McpServerDto::from(updated))
    }

    pub async fn delete_server(&self, id: &str) -> Result<(), AppError> {
        // 先断开连接
        {
            let mut runtimes = self.runtimes.lock().await;
            runtimes.remove(id);
        }

        mcp_server::Entity::delete_by_id(id)
            .exec(&self.db)
            .await?;
        Ok(())
    }

    // ─── 启用/禁用 ─────────────────────────────────────────────────────

    pub async fn set_enabled(&self, id: &str, enabled: bool) -> Result<McpServerDto, AppError> {
        let model = mcp_server::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("MCP server '{id}' not found")))?;

        let now = chrono::Utc::now().to_rfc3339();
        let mut active: mcp_server::ActiveModel = model.into();
        active.enabled = Set(if enabled { 1 } else { 0 });
        active.updated_at = Set(now);

        if !enabled {
            // 断开连接
            let mut runtimes = self.runtimes.lock().await;
            runtimes.remove(id);
        }

        let updated = active.update(&self.db).await?;
        Ok(McpServerDto::from(updated))
    }

    // ─── 工具列表 ──────────────────────────────────────────────────────

    /// 获取某个服务器的工具列表（必要时连接并刷新）
    pub async fn list_tools(&self, server_id: &str) -> Result<Vec<McpToolDef>, String> {
        let server = self
            .get_server(server_id)
            .await
            .map_err(|e| e.to_string())?;
        self.ensure_connected_and_list_tools(&server).await
    }

    /// 获取所有已启用服务器的工具列表（用于 chat ToolRegistry 合并）
    pub async fn all_enabled_tools(&self) -> Vec<McpToolDef> {
        let servers = match self.list_servers().await {
            Ok(s) => s,
            Err(_) => return vec![],
        };

        let mut all_tools = Vec::new();
        for server in servers.iter().filter(|s| s.enabled) {
            match self.ensure_connected_and_list_tools(server).await {
                Ok(tools) => all_tools.extend(tools),
                Err(e) => {
                    crate::logger::warn(
                        "mcp",
                        format!("Failed to get tools for {}: {}", server.id, e),
                    );
                }
            }
        }
        all_tools
    }

    /// 确保服务器已连接并返回工具列表
    async fn ensure_connected_and_list_tools(
        &self,
        server: &McpServerDto,
    ) -> Result<Vec<McpToolDef>, String> {
        let server_id = server.id.clone();

        // 若已有运行中的连接且有缓存工具，直接返回
        {
            let runtimes = self.runtimes.lock().await;
            if let Some(runtime) = runtimes.get(&server_id) {
                if runtime.status == McpServerStatus::Running && !runtime.cached_tools.is_empty() {
                    return Ok(runtime.cached_tools.clone());
                }
            }
        }

        // 建立连接（在不持有 runtimes 锁的情况下执行）
        let tools = self.connect_and_fetch_tools(server).await?;

        // 同步更新 DB 状态
        let _ = self.update_status(&server_id, "running", None).await;

        Ok(tools)
    }

    /// 连接服务器并获取工具列表
    async fn connect_and_fetch_tools(
        &self,
        server: &McpServerDto,
    ) -> Result<Vec<McpToolDef>, String> {
        self.connect_and_fetch_tools_with_mode(server, true).await
    }

    async fn connect_and_fetch_tools_with_mode(
        &self,
        server: &McpServerDto,
        persist_runtime: bool,
    ) -> Result<Vec<McpToolDef>, String> {
        match server.transport.as_str() {
            "stdio" => self
                .connect_stdio_and_fetch_tools(server, persist_runtime)
                .await,
            "http" | "sse" => self
                .connect_http_and_fetch_tools(server, persist_runtime)
                .await,
            t => Err(format!("Unsupported transport: {t}")),
        }
    }

    async fn connect_stdio_and_fetch_tools(
        &self,
        server: &McpServerDto,
        persist_runtime: bool,
    ) -> Result<Vec<McpToolDef>, String> {
        let command = server
            .command
            .as_deref()
            .ok_or("stdio transport requires a command")?;

        let args: Vec<String> = serde_json::from_str(&server.args_json)
            .map_err(|e| format!("Invalid args_json: {e}"))?;
        let env_map: HashMap<String, String> = serde_json::from_str(&server.env_json)
            .map_err(|e| format!("Invalid env_json: {e}"))?;

        let mut child = tokio::process::Command::new(command)
            .args(&args)
            .envs(&env_map)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn '{command}': {e}"))?;

        let stdin = child.stdin.take().ok_or("Failed to get child stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to get child stdout")?;

        let mut transport = StdioTransport {
            stdin,
            stdout_reader: tokio::io::BufReader::new(stdout),
            next_id: 1,
        };

        // MCP initialize handshake
        let init_result = transport
            .call(
                "initialize",
                json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "roots": { "listChanged": false } },
                    "clientInfo": { "name": "multi-flow", "version": "1.0.0" }
                }),
            )
            .await?;

        crate::logger::info(
            "mcp",
            format!(
                "MCP server '{}' initialized: {:?}",
                server.name,
                init_result.get("serverInfo")
            ),
        );

        // 发送 initialized 通知
        transport
            .notify("notifications/initialized", json!({}))
            .await?;

        // 获取工具列表
        let tools_result = transport.call("tools/list", json!({})).await?;
        let tools = parse_tools_response(tools_result, &server.id, &server.name)?;

        if persist_runtime {
            let mut runtimes = self.runtimes.lock().await;
            runtimes.insert(
                server.id.clone(),
                McpServerRuntime {
                    cached_tools: tools.clone(),
                    status: McpServerStatus::Running,
                    transport: McpRuntimeTransport::Stdio { child, transport },
                },
            );
        } else {
            let _ = child.kill().await;
        }

        Ok(tools)
    }

    async fn connect_http_and_fetch_tools(
        &self,
        server: &McpServerDto,
        persist_runtime: bool,
    ) -> Result<Vec<McpToolDef>, String> {
        let url = server
            .url
            .as_deref()
            .ok_or("http/sse transport requires a URL")?;

        let headers: HashMap<String, String> = serde_json::from_str(&server.headers_json)
            .map_err(|e| format!("Invalid headers_json: {e}"))?;

        // 获取 bearer token（包含 OAuth 自动刷新）
        let bearer_token = self.get_effective_bearer_token(server).await?;

        let mut transport = HttpTransport::new(url.to_string(), headers, bearer_token);

        // MCP initialize
        let _init_result = transport
            .call(
                "initialize",
                json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": { "name": "multi-flow", "version": "1.0.0" }
                }),
            )
            .await?;

        // 获取工具列表
        let tools_result = transport.call("tools/list", json!({})).await?;
        let tools = parse_tools_response(tools_result, &server.id, &server.name)?;

        if persist_runtime {
            let mut runtimes = self.runtimes.lock().await;
            runtimes.insert(
                server.id.clone(),
                McpServerRuntime {
                    cached_tools: tools.clone(),
                    status: McpServerStatus::Running,
                    transport: McpRuntimeTransport::Http(transport),
                },
            );
        }

        Ok(tools)
    }

    /// 获取有效的 Bearer token（自动处理 OAuth 刷新）
    async fn get_effective_bearer_token(
        &self,
        server: &McpServerDto,
    ) -> Result<Option<String>, String> {
        match server.auth_type.as_str() {
            "bearer" => Ok(server.bearer_token.clone()),
            "oauth" => {
                let tokens_json = server
                    .oauth_tokens_json
                    .as_deref()
                    .ok_or("OAuth tokens not set. Please complete OAuth authorization first.")?;
                let mut tokens: OAuthTokens = serde_json::from_str(tokens_json)
                    .map_err(|e| format!("Invalid oauth_tokens_json: {e}"))?;

                // 检查是否需要刷新（提前 60 秒）
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                if let Some(expires_at) = tokens.expires_at {
                    if expires_at < now + 60 {
                        if let Some(refresh_token) = &tokens.refresh_token.clone() {
                            let config_json = server
                                .oauth_config_json
                                .as_deref()
                                .ok_or("OAuth config not set")?;
                            let config: OAuthConfig = serde_json::from_str(config_json)
                                .map_err(|e| format!("Invalid oauth_config_json: {e}"))?;
                            tokens =
                                super::oauth::refresh_access_token(&config, refresh_token).await?;
                            // 保存新 token 到 DB
                            let tokens_json =
                                serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
                            let _ = self.save_oauth_tokens(&server.id, &tokens_json).await;
                        }
                    }
                }

                Ok(Some(tokens.access_token))
            }
            _ => Ok(None),
        }
    }

    // ─── 工具调用 ──────────────────────────────────────────────────────

    /// 调用 MCP 工具
    pub async fn call_tool(
        &self,
        server_id: &str,
        tool_name: &str,
        args: Value,
    ) -> Result<String, String> {
        let server = self
            .get_server(server_id)
            .await
            .map_err(|e| e.to_string())?;

        // 确保连接（必要时重连）
        self.ensure_connected_and_list_tools(&server).await?;

        let mut runtimes = self.runtimes.lock().await;
        let runtime = runtimes
            .get_mut(server_id)
            .ok_or_else(|| "MCP server not connected".to_string())?;

        let result = match &mut runtime.transport {
            McpRuntimeTransport::Stdio { transport, .. } => {
                transport
                    .call(
                        "tools/call",
                        json!({
                            "name": tool_name,
                            "arguments": args,
                        }),
                    )
                    .await
            }
            McpRuntimeTransport::Http(transport) => {
                transport
                    .call(
                        "tools/call",
                        json!({
                            "name": tool_name,
                            "arguments": args,
                        }),
                    )
                    .await
            }
            McpRuntimeTransport::None => Err("No transport available".to_string()),
        }?;

        // MCP tools/call 响应格式: { content: [{type: "text", text: "..."}] }
        let content = result
            .get("content")
            .and_then(|c| c.as_array())
            .ok_or("Invalid tools/call response: missing content array")?;

        let text = content
            .iter()
            .filter_map(|item| {
                if item.get("type")?.as_str()? == "text" {
                    item.get("text")?.as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        Ok(text)
    }

    // ─── 连接测试 ──────────────────────────────────────────────────────

    /// 测试连接（连接并获取工具列表）
    pub async fn test_connection(&self, server_id: &str) -> Result<String, String> {
        let server = self
            .get_server(server_id)
            .await
            .map_err(|e| e.to_string())?;

        match self.connect_and_fetch_tools(&server).await {
            Ok(tools) => Ok(format!("Connected. {} tools available.", tools.len())),
            Err(e) => Err(e),
        }
    }

    /// 使用未保存的草稿配置测试连接
    pub async fn test_connection_draft(
        &self,
        payload: CreateMcpServerRequest,
    ) -> Result<String, String> {
        let server = build_server_draft(payload);
        match self.connect_and_fetch_tools_with_mode(&server, false).await {
            Ok(tools) => Ok(format!("Connected. {} tools available.", tools.len())),
            Err(e) => Err(e),
        }
    }

    // ─── OAuth ────────────────────────────────────────────────────────

    /// 开始 OAuth 授权流程，打开系统浏览器并等待回调
    pub async fn start_oauth(&self, server_id: &str) -> Result<String, String> {
        let server = self
            .get_server(server_id)
            .await
            .map_err(|e| e.to_string())?;

        let config_json = server
            .oauth_config_json
            .as_deref()
            .ok_or("OAuth config not set for this server")?;
        let config: OAuthConfig = serde_json::from_str(config_json)
            .map_err(|e| format!("Invalid oauth_config_json: {e}"))?;

        let (verifier, challenge) = super::oauth::generate_pkce();
        let port = super::oauth::find_available_port();
        let redirect_uri = format!("http://127.0.0.1:{}/callback", port);

        // 构造授权 URL
        let scopes = config.scopes.join(" ");
        let auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&code_challenge={}&code_challenge_method=S256&scope={}",
            config.auth_url,
            urlencoding::encode(&config.client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&challenge),
            urlencoding::encode(&scopes),
        );

        // 打开系统浏览器
        let _ = open::that(&auth_url);

        // 等待回调
        let code = super::oauth::wait_for_oauth_callback(port).await?;

        // 换取 token
        let tokens = super::oauth::exchange_code_for_token(&config, &code, &redirect_uri, &verifier).await?;

        // 保存 token 到 DB
        let tokens_json = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
        self.save_oauth_tokens(server_id, &tokens_json).await?;

        Ok("OAuth authorization completed successfully".to_string())
    }

    /// 保存 OAuth tokens 到数据库
    async fn save_oauth_tokens(&self, server_id: &str, tokens_json: &str) -> Result<(), String> {
        let model = mcp_server::Entity::find_by_id(server_id)
            .one(&self.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Server '{server_id}' not found"))?;

        let now = chrono::Utc::now().to_rfc3339();
        let mut active: mcp_server::ActiveModel = model.into();
        active.oauth_tokens_json = Set(Some(tokens_json.to_string()));
        active.updated_at = Set(now);
        active.update(&self.db).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    // ─── 状态管理 ──────────────────────────────────────────────────────

    /// 更新 DB 中的 last_status 和 last_error
    async fn update_status(
        &self,
        server_id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<(), AppError> {
        let model = mcp_server::Entity::find_by_id(server_id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Server '{server_id}' not found")))?;

        let now = chrono::Utc::now().to_rfc3339();
        let mut active: mcp_server::ActiveModel = model.into();
        active.last_status = Set(status.to_string());
        active.last_error = Set(error.map(|s| s.to_string()));
        active.updated_at = Set(now);
        active.update(&self.db).await?;
        Ok(())
    }

    /// 刷新所有已启用服务器（应用启动时调用）
    pub async fn refresh_all_enabled(&self) {
        let servers = match self.list_servers().await {
            Ok(s) => s,
            Err(e) => {
                crate::logger::warn("mcp", format!("Failed to list MCP servers: {e}"));
                return;
            }
        };

        for server in servers.iter().filter(|s| s.enabled) {
            let server_id = server.id.clone();
            match self.ensure_connected_and_list_tools(server).await {
                Ok(tools) => {
                    crate::logger::info(
                        "mcp",
                        format!(
                            "MCP server '{}' connected, {} tools",
                            server.name,
                            tools.len()
                        ),
                    );
                }
                Err(e) => {
                    crate::logger::warn(
                        "mcp",
                        format!("MCP server '{}' failed to connect: {e}", server.name),
                    );
                    let _ = self.update_status(&server_id, "error", Some(&e)).await;
                }
            }
        }
    }

    /// 断开所有连接（应用退出时调用）
    pub async fn shutdown_all(&self) {
        let mut runtimes = self.runtimes.lock().await;
        for (id, runtime) in runtimes.iter_mut() {
            if let McpRuntimeTransport::Stdio { child, .. } = &mut runtime.transport {
                let _ = child.kill().await;
            }
            crate::logger::info("mcp", format!("MCP server '{id}' disconnected"));
        }
        runtimes.clear();
    }

    /// 将工具列表转为 OpenAI function schema 格式
    pub fn tools_to_openai_schema(tools: &[McpToolDef]) -> Vec<Value> {
        tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description.as_deref().unwrap_or(""),
                        "parameters": tool.input_schema,
                    }
                })
            })
            .collect()
    }
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────

fn build_server_draft(payload: CreateMcpServerRequest) -> McpServerDto {
    let now = chrono::Utc::now().to_rfc3339();
    McpServerDto {
        id: format!("draft-{}", uuid::Uuid::new_v4()),
        name: payload.name,
        transport: payload.transport,
        command: payload.command,
        args_json: payload.args_json.unwrap_or_else(|| "[]".to_string()),
        env_json: payload.env_json.unwrap_or_else(|| "{}".to_string()),
        url: payload.url,
        headers_json: payload.headers_json.unwrap_or_else(|| "{}".to_string()),
        auth_type: payload.auth_type.unwrap_or_else(|| "none".to_string()),
        bearer_token: payload.bearer_token,
        oauth_config_json: payload.oauth_config_json,
        oauth_tokens_json: None,
        enabled: false,
        last_status: "idle".to_string(),
        last_error: None,
        created_at: now.clone(),
        updated_at: now,
    }
}

/// 将服务器名称转为 slug（用于工具命名）
fn server_slug(server_name: &str) -> String {
    server_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// 解析 MCP tools/list 响应
fn parse_tools_response(
    result: Value,
    server_id: &str,
    server_name: &str,
) -> Result<Vec<McpToolDef>, String> {
    let tools_array = result
        .get("tools")
        .and_then(|t| t.as_array())
        .ok_or("Invalid tools/list response: missing tools array")?;

    let slug = server_slug(server_name);
    let tools = tools_array
        .iter()
        .filter_map(|tool| {
            let original_name = tool.get("name")?.as_str()?.to_string();
            let full_name = format!("mcp__{}__{}", slug, original_name);
            Some(McpToolDef {
                server_id: server_id.to_string(),
                server_name: server_name.to_string(),
                name: full_name,
                original_name,
                description: tool
                    .get("description")
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string()),
                input_schema: tool.get("inputSchema").cloned().unwrap_or_else(|| {
                    json!({"type": "object", "properties": {}})
                }),
            })
        })
        .collect();

    Ok(tools)
}
