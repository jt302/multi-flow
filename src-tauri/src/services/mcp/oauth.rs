//! OAuth PKCE 授权流程
//! 用于为 MCP server 获取访问令牌

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub auth_url: String,
    pub token_url: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>, // unix timestamp
    pub token_type: Option<String>,
}

/// 生成 PKCE code_verifier 和 code_challenge
pub fn generate_pkce() -> (String, String) {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let verifier: String = (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..62usize);
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[idx] as char
        })
        .collect();
    let challenge = {
        let mut hasher = sha2::Sha256::new();
        hasher.update(verifier.as_bytes());
        let hash = hasher.finalize();
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash)
    };
    (verifier, challenge)
}

/// 在随机端口启动本地 HTTP loopback 服务，等待 OAuth 回调
/// 返回 authorization_code（同时校验 state 防止 CSRF）
pub async fn wait_for_oauth_callback(port: u16, expected_state: String) -> Result<String, String> {
    use axum::{extract::Query, routing::get, Router};
    use std::net::SocketAddr;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel::<Result<String, String>>();
    let tx = std::sync::Arc::new(tokio::sync::Mutex::new(Some(tx)));

    let tx_clone = tx.clone();
    let app = Router::new().route(
        "/callback",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let tx = tx_clone.clone();
            let state_expected = expected_state.clone();
            async move {
                let received_state = params.get("state").map(|s| s.as_str()).unwrap_or("");
                if received_state != state_expected {
                    let mut lock = tx.lock().await;
                    if let Some(sender) = lock.take() {
                        let _ = sender.send(Err(
                            "OAuth state mismatch (possible CSRF attack)".to_string()
                        ));
                    }
                    return "Authorization failed: state mismatch. You can close this window."
                        .to_string();
                }
                if let Some(code) = params.get("code") {
                    let mut lock = tx.lock().await;
                    if let Some(sender) = lock.take() {
                        let _ = sender.send(Ok(code.clone()));
                    }
                }
                "Authorization complete. You can close this window.".to_string()
            }
        }),
    );

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind OAuth callback server: {e}"))?;

    let server_handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    // 等待回调（180 秒超时）
    let result = tokio::time::timeout(std::time::Duration::from_secs(180), rx)
        .await
        .map_err(|_| "OAuth authorization timed out (180s)".to_string())?
        .map_err(|_| "OAuth callback channel closed".to_string())?;

    server_handle.abort();
    result
}

/// 用 code 换取 access_token
pub async fn exchange_code_for_token(
    config: &OAuthConfig,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code".to_string());
    params.insert("code", code.to_string());
    params.insert("redirect_uri", redirect_uri.to_string());
    params.insert("client_id", config.client_id.clone());
    params.insert("code_verifier", code_verifier.to_string());
    if let Some(secret) = &config.client_secret {
        params.insert("client_secret", secret.clone());
    }

    let response = client
        .post(&config.token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed HTTP {status}: {body}"));
    }

    let token_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Token response parse failed: {e}"))?;

    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("Missing access_token in response")?
        .to_string();

    let refresh_token = token_response["refresh_token"]
        .as_str()
        .map(|s| s.to_string());

    let expires_at = token_response["expires_in"].as_i64().map(|secs| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        now + secs
    });

    let token_type = token_response["token_type"].as_str().map(|s| s.to_string());

    Ok(OAuthTokens {
        access_token,
        refresh_token,
        expires_at,
        token_type,
    })
}

/// 刷新 access_token
pub async fn refresh_access_token(
    config: &OAuthConfig,
    refresh_token: &str,
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("grant_type", "refresh_token".to_string());
    params.insert("refresh_token", refresh_token.to_string());
    params.insert("client_id", config.client_id.clone());
    if let Some(secret) = &config.client_secret {
        params.insert("client_secret", secret.clone());
    }

    let response = client
        .post(&config.token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed HTTP {status}: {body}"));
    }

    let token_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Token response parse failed: {e}"))?;

    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?
        .to_string();

    let refresh_token_new = token_response["refresh_token"]
        .as_str()
        .map(|s| s.to_string())
        .or_else(|| Some(refresh_token.to_string()));

    let expires_at = token_response["expires_in"].as_i64().map(|secs| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        now + secs
    });

    let token_type = token_response["token_type"].as_str().map(|s| s.to_string());

    Ok(OAuthTokens {
        access_token,
        refresh_token: refresh_token_new,
        expires_at,
        token_type,
    })
}

/// 查找可用端口（从 54320 开始）
pub fn find_available_port() -> u16 {
    for port in 54320..54400u16 {
        if std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return port;
        }
    }
    54320
}

// ─── OS Keychain 存储（替代明文 SQLite） ──────────────────────────────────

const KEYRING_SERVICE: &str = "io.multiflow.app.mcp";

/// 把 OAuth/Bearer token 存入 OS keychain（macOS Keychain / Windows Credential Store / Linux Secret Service）
pub fn save_tokens_to_keychain(server_id: &str, tokens_json: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, server_id)
        .map_err(|e| format!("Keychain 条目创建失败: {e}"))?;
    entry
        .set_password(tokens_json)
        .map_err(|e| format!("Keychain 写入失败: {e}"))
}

/// 从 OS keychain 读取 token（不存在时返回 None）
pub fn load_tokens_from_keychain(server_id: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, server_id)
        .map_err(|e| format!("Keychain 条目创建失败: {e}"))?;
    match entry.get_password() {
        Ok(tokens) => Ok(Some(tokens)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keychain 读取失败: {e}")),
    }
}

/// 删除 OS keychain 中的 token（server 删除时调用）
pub fn delete_tokens_from_keychain(server_id: &str) {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, server_id) {
        let _ = entry.delete_credential();
    }
}

// ─── RFC 8414 / OpenID Connect 授权服务器元数据发现 ──────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthDiscoveryResult {
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub scopes_supported: Vec<String>,
}

/// 尝试从给定基础 URL 发现 OAuth 授权服务器元数据（RFC 8414 / OpenID Connect）
///
/// 按顺序尝试：
/// 1. `{base}/.well-known/oauth-authorization-server`（RFC 8414）
/// 2. `{base}/.well-known/openid-configuration`（OpenID Connect Discovery）
pub async fn discover_oauth_metadata(base_url: &str) -> Result<OAuthDiscoveryResult, String> {
    let base = base_url.trim_end_matches('/');
    let candidates = [
        format!("{base}/.well-known/oauth-authorization-server"),
        format!("{base}/.well-known/openid-configuration"),
    ];

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let mut last_err = String::new();
    for url in &candidates {
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("发现端点响应解析失败: {e}"))?;

                let auth_ep = body
                    .get("authorization_endpoint")
                    .and_then(|v| v.as_str())
                    .ok_or("发现文档缺少 authorization_endpoint 字段")?
                    .to_string();
                let token_ep = body
                    .get("token_endpoint")
                    .and_then(|v| v.as_str())
                    .ok_or("发现文档缺少 token_endpoint 字段")?
                    .to_string();
                let scopes = body
                    .get("scopes_supported")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|s| s.as_str())
                            .map(|s| s.to_string())
                            .collect()
                    })
                    .unwrap_or_default();

                return Ok(OAuthDiscoveryResult {
                    authorization_endpoint: auth_ep,
                    token_endpoint: token_ep,
                    scopes_supported: scopes,
                });
            }
            Ok(resp) => {
                last_err = format!("HTTP {} from {url}", resp.status());
            }
            Err(e) => {
                last_err = format!("{e}");
            }
        }
    }

    Err(format!("未找到 OAuth 元数据端点（最后错误: {last_err}）"))
}
