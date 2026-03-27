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

    pub async fn call(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let ws_url = self.get_page_ws_url().await?;
        let (mut ws, _) = connect_async(&ws_url)
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
}
