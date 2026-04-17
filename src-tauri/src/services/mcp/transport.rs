//! MCP 传输层实现
//! 支持 stdio（子进程）和 HTTP（直接 POST）两种传输方式

use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout};

/// stdio 传输：维护对子进程 stdin/stdout 的 JSON-RPC 通信
pub struct StdioTransport {
    pub stdin: ChildStdin,
    pub stdout_reader: BufReader<ChildStdout>,
    pub next_id: u64,
}

impl StdioTransport {
    /// 发送 JSON-RPC 请求并等待匹配响应
    pub async fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        let mut line = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        self.stdin.flush().await.map_err(|e| e.to_string())?;

        // 读取直到收到匹配 id 的响应（跳过通知消息）
        let timeout_duration = std::time::Duration::from_secs(30);
        let result = tokio::time::timeout(timeout_duration, async {
            loop {
                let mut resp_line = String::new();
                self.stdout_reader
                    .read_line(&mut resp_line)
                    .await
                    .map_err(|e| format!("read_line error: {e}"))?;
                let trimmed = resp_line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let resp: Value = serde_json::from_str(trimmed)
                    .map_err(|e| format!("JSON parse error: {e} for: {trimmed}"))?;
                // 跳过通知（没有 id 字段）
                if resp.get("id").is_none() {
                    continue;
                }
                if resp["id"].as_u64() == Some(id) {
                    if let Some(error) = resp.get("error") {
                        return Err(format!("MCP error: {error}"));
                    }
                    return Ok(resp["result"].clone());
                }
            }
        })
        .await
        .map_err(|_| format!("MCP call '{method}' timed out (30s)"))?;

        result
    }

    /// 发送 initialized 通知（JSON-RPC notification，无需响应）
    pub async fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        let notification = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        let mut line = serde_json::to_string(&notification).map_err(|e| e.to_string())?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        self.stdin.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// HTTP 传输：向 MCP server URL 发送 POST 请求
pub struct HttpTransport {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub bearer_token: Option<String>,
    pub client: reqwest::Client,
    pub next_id: u64,
}

impl HttpTransport {
    pub fn new(
        url: String,
        headers: HashMap<String, String>,
        bearer_token: Option<String>,
    ) -> Self {
        Self {
            url,
            headers,
            bearer_token,
            client: reqwest::Client::new(),
            next_id: 1,
        }
    }

    /// 发送 JSON-RPC POST 请求并等待响应
    pub async fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let mut req = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json");

        if let Some(token) = &self.bearer_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        for (k, v) in &self.headers {
            req = req.header(k, v);
        }

        let timeout_duration = std::time::Duration::from_secs(30);
        let response = tokio::time::timeout(timeout_duration, req.json(&request).send())
            .await
            .map_err(|_| format!("HTTP call '{method}' timed out (30s)"))?
            .map_err(|e| format!("HTTP request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("HTTP {status}: {body}"));
        }

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if content_type.contains("text/event-stream") {
            // SSE 响应：读取第一个 data: 行
            let text = response.text().await.map_err(|e| e.to_string())?;
            for line in text.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    let resp: Value = serde_json::from_str(data)
                        .map_err(|e| format!("SSE JSON parse error: {e}"))?;
                    if let Some(error) = resp.get("error") {
                        return Err(format!("MCP error: {error}"));
                    }
                    return Ok(resp["result"].clone());
                }
            }
            Err("No SSE data received".to_string())
        } else {
            let resp: Value = response.json().await.map_err(|e| e.to_string())?;
            if let Some(error) = resp.get("error") {
                return Err(format!("MCP error: {error}"));
            }
            Ok(resp["result"].clone())
        }
    }
}
