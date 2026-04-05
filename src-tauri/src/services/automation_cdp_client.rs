use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};

pub struct CdpClient {
    debug_port: u16,
    http_client: reqwest::Client,
}

impl CdpClient {
    pub fn new(debug_port: u16) -> Self {
        Self {
            debug_port,
            http_client: reqwest::Client::new(),
        }
    }

    /// 获取 debug 端口号
    pub fn debug_port(&self) -> u16 {
        self.debug_port
    }

    pub async fn get_page_ws_url(&self) -> Result<String, String> {
        let url = format!("http://127.0.0.1:{}/json/list", self.debug_port);
        let resp = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("CDP /json/list request failed: {e}"))?;
        let targets: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("CDP /json/list parse failed: {e}"))?;
        let targets = targets
            .as_array()
            .ok_or_else(|| "CDP /json/list did not return array".to_string())?;
        let page_target = targets
            .iter()
            .find(|t| t.get("type").and_then(|v| v.as_str()) == Some("page"))
            .ok_or_else(|| "no page target found in CDP target list".to_string())?;
        let ws_url = page_target
            .get("webSocketDebuggerUrl")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "no webSocketDebuggerUrl in page target".to_string())?;
        Ok(ws_url.to_string())
    }

    pub async fn get_browser_ws_url(&self) -> Result<String, String> {
        let url = format!("http://127.0.0.1:{}/json/version", self.debug_port);
        let resp = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("CDP /json/version request failed: {e}"))?;
        let info: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("CDP /json/version parse failed: {e}"))?;
        info.get("webSocketDebuggerUrl")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "no webSocketDebuggerUrl in /json/version".to_string())
    }

    async fn call_on_ws(
        &self,
        ws_url: &str,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let (mut ws, _) = connect_async(ws_url)
            .await
            .map_err(|e| format!("CDP WebSocket connect failed: {e}"))?;

        let request_id: u64 = 1;
        let payload = serde_json::json!({
            "id": request_id,
            "method": method,
            "params": params,
        });
        ws.send(Message::Text(payload.to_string().into()))
            .await
            .map_err(|e| format!("CDP send failed: {e}"))?;

        while let Some(msg) = ws.next().await {
            let msg = msg.map_err(|e| format!("CDP recv failed: {e}"))?;
            let text = match msg {
                Message::Text(t) => t.to_string(),
                Message::Close(_) => return Err("CDP connection closed".to_string()),
                _ => continue,
            };
            let parsed: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| format!("CDP parse failed: {e}"))?;
            if parsed.get("id").and_then(|v| v.as_u64()) == Some(request_id) {
                if let Some(error) = parsed.get("error") {
                    return Err(format!("CDP error: {error}"));
                }
                return Ok(parsed.get("result").cloned().unwrap_or(serde_json::Value::Null));
            }
        }
        Err("CDP connection closed without response".to_string())
    }

    /// 在 page 级目标上调用 CDP 方法（DOM/Input/Runtime/Page 操作使用此方法）
    pub async fn call(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let ws_url = self.get_page_ws_url().await?;
        self.call_on_ws(&ws_url, method, params).await
    }

    /// 在同一个 WebSocket 连接中顺序执行多条 CDP 命令，返回各命令结果。
    /// 用于需要在同一 session 内保持状态的操作（如 DOM.enable → DOM.getDocument → DOM.setFileInputFiles）。
    pub async fn call_sequence(
        &self,
        calls: &[(&str, serde_json::Value)],
    ) -> Result<Vec<serde_json::Value>, String> {
        let ws_url = self.get_page_ws_url().await?;
        let (mut ws, _) = tokio_tungstenite::connect_async(&ws_url)
            .await
            .map_err(|e| format!("CDP WebSocket connect failed: {e}"))?;

        let mut results = Vec::with_capacity(calls.len());
        for (idx, (method, params)) in calls.iter().enumerate() {
            let req_id = (idx + 1) as u64;
            let payload = serde_json::json!({ "id": req_id, "method": method, "params": params });
            ws.send(tokio_tungstenite::tungstenite::Message::Text(
                payload.to_string().into(),
            ))
            .await
            .map_err(|e| format!("CDP send failed: {e}"))?;

            // 等待与 req_id 匹配的响应（忽略事件消息）
            let result = loop {
                let msg = ws
                    .next()
                    .await
                    .ok_or_else(|| "CDP connection closed".to_string())?
                    .map_err(|e| format!("CDP recv failed: {e}"))?;
                let text = match msg {
                    tokio_tungstenite::tungstenite::Message::Text(t) => t.to_string(),
                    tokio_tungstenite::tungstenite::Message::Close(_) => {
                        return Err("CDP connection closed".to_string())
                    }
                    _ => continue,
                };
                let parsed: serde_json::Value = serde_json::from_str(&text)
                    .map_err(|e| format!("CDP parse failed: {e}"))?;
                if parsed.get("id").and_then(|v| v.as_u64()) == Some(req_id) {
                    if let Some(error) = parsed.get("error") {
                        return Err(format!("CDP error: {error}"));
                    }
                    break parsed.get("result").cloned().unwrap_or(serde_json::Value::Null);
                }
            };
            results.push(result);
        }
        Ok(results)
    }

    /// 在 browser 级目标上调用 CDP 方法（Target.* 和 Browser.* 使用此方法）
    pub async fn call_browser(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let ws_url = self.get_browser_ws_url().await?;
        self.call_on_ws(&ws_url, method, params).await
    }
}
