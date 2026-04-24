use std::collections::HashMap;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::{Arc, RwLock};
use std::time::Duration;

use axum::extract::ws::rejection::WebSocketUpgradeRejection;
use axum::extract::ws::{Message as AxumWsMessage, WebSocket, WebSocketUpgrade};
use axum::extract::OriginalUri;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use serde_json::Value;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as TungsteniteMessage;

use crate::error::{AppError, AppResult};
use crate::logger;

#[derive(Clone)]
struct UpstreamTarget {
    host: String,
    port: u16,
}

#[derive(Clone)]
struct AdapterServerState {
    listen_port: u16,
    upstream: Arc<RwLock<UpstreamTarget>>,
    client: Client,
}

struct ChromiumMagicAdapterHandle {
    listen_port: u16,
    upstream: Arc<RwLock<UpstreamTarget>>,
}

pub struct ChromiumMagicAdapterService {
    adapters: HashMap<String, ChromiumMagicAdapterHandle>,
}

impl ChromiumMagicAdapterService {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
        }
    }

    pub fn ensure_adapter(
        &mut self,
        profile_id: &str,
        upstream_host: &str,
        upstream_port: u16,
    ) -> AppResult<u16> {
        if upstream_port == 0 {
            return Err(AppError::Validation(
                "invalid chromium magic upstream port: 0".to_string(),
            ));
        }

        if let Some(handle) = self.adapters.get(profile_id) {
            let mut upstream = handle
                .upstream
                .write()
                .map_err(|_| AppError::Validation("adapter upstream lock poisoned".to_string()))?;
            upstream.host = upstream_host.to_string();
            upstream.port = upstream_port;
            return Ok(handle.listen_port);
        }

        let listen_port = reserve_local_port()?;
        let upstream = Arc::new(RwLock::new(UpstreamTarget {
            host: upstream_host.to_string(),
            port: upstream_port,
        }));
        spawn_adapter_server(listen_port, upstream.clone())?;
        self.adapters.insert(
            profile_id.to_string(),
            ChromiumMagicAdapterHandle {
                listen_port,
                upstream,
            },
        );
        Ok(listen_port)
    }
}

fn spawn_adapter_server(listen_port: u16, upstream: Arc<RwLock<UpstreamTarget>>) -> AppResult<()> {
    let address = SocketAddr::from(([127, 0, 0, 1], listen_port));
    let state = AdapterServerState {
        listen_port,
        upstream,
        client: Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| Client::new()),
    };
    let app = build_adapter_router(state);

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(address).await {
            Ok(listener) => listener,
            Err(err) => {
                logger::error(
                    "magic_adapter",
                    format!("bind adapter server failed port={listen_port} err={err}"),
                );
                return;
            }
        };
        if let Err(err) = axum::serve(listener, app).await {
            logger::warn(
                "magic_adapter",
                format!("adapter server stopped port={listen_port} err={err}"),
            );
        }
    });

    for _ in 0..20 {
        if is_port_open(listen_port) {
            logger::info(
                "magic_adapter",
                format!("adapter server started listen_port={listen_port}"),
            );
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    Err(AppError::Validation(format!(
        "adapter server startup timed out port={listen_port}"
    )))
}

fn build_adapter_router(state: AdapterServerState) -> Router {
    Router::new()
        .route("/", get(proxy_get_entry).post(proxy_http))
        .route("/{*path}", get(proxy_get_entry).post(proxy_http))
        .with_state(state)
}

async fn proxy_http(
    State(state): State<AdapterServerState>,
    uri: OriginalUri,
    Json(payload): Json<Value>,
) -> Response {
    let command = extract_command_name(&payload);
    let upstream = match state.upstream.read() {
        Ok(value) => value.clone(),
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("adapter upstream lock poisoned")),
            )
                .into_response();
        }
    };
    let endpoint = format!(
        "http://{}:{}{}",
        upstream.host,
        upstream.port,
        normalize_proxy_path(&uri.0),
    );
    match state.client.post(endpoint).json(&payload).send().await {
        Ok(response) => {
            let status = response.status();
            match response.json::<Value>().await {
                Ok(mut value) => {
                    rewrite_bounds_value(&mut value);
                    rewrite_float_integers(&mut value);
                    rewrite_switch_port_value(&payload, &mut value, state.listen_port);
                    if command.as_deref() == Some("get_switches")
                        || command.as_deref() == Some("get_sync_status")
                    {
                        logger::info(
                            "magic_adapter",
                            format!(
                                "http proxy success listen_port={} upstream={}:{} cmd={} status={}",
                                state.listen_port,
                                upstream.host,
                                upstream.port,
                                command.as_deref().unwrap_or("unknown"),
                                status
                            ),
                        );
                    }
                    (status, Json(value)).into_response()
                }
                Err(err) => (
                    StatusCode::BAD_GATEWAY,
                    Json(json_error(&format!(
                        "decode upstream response failed: {err}"
                    ))),
                )
                    .into_response(),
            }
        }
        Err(err) => {
            logger::warn(
                "magic_adapter",
                format!(
                    "http proxy failed listen_port={} upstream={}:{} cmd={} err={err}",
                    state.listen_port,
                    upstream.host,
                    upstream.port,
                    command.as_deref().unwrap_or("unknown"),
                ),
            );
            (
                StatusCode::BAD_GATEWAY,
                Json(json_error(&format!("proxy upstream http failed: {err}"))),
            )
                .into_response()
        }
    }
}

async fn proxy_get_entry(
    ws: Result<WebSocketUpgrade, WebSocketUpgradeRejection>,
    State(state): State<AdapterServerState>,
    uri: OriginalUri,
) -> Response {
    let path_and_query = normalize_proxy_path(&uri.0);
    match ws {
        Ok(upgrade) => {
            logger::info(
                "magic_adapter",
                format!(
                    "ws upgrade accepted listen_port={} path={}",
                    state.listen_port, path_and_query
                ),
            );
            let response: Response = upgrade
                .on_upgrade(move |socket| proxy_ws(socket, state, path_and_query))
                .into_response();
            response
        }
        Err(err) => {
            logger::warn(
                "magic_adapter",
                format!(
                    "ws upgrade rejected listen_port={} path={} err={err}",
                    state.listen_port, path_and_query
                ),
            );
            proxy_http_get(State(state), uri).await
        }
    }
}

async fn proxy_http_get(State(state): State<AdapterServerState>, uri: OriginalUri) -> Response {
    let upstream = match state.upstream.read() {
        Ok(value) => value.clone(),
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("adapter upstream lock poisoned")),
            )
                .into_response();
        }
    };
    let endpoint = format!(
        "http://{}:{}{}",
        upstream.host,
        upstream.port,
        normalize_proxy_path(&uri.0),
    );
    logger::info(
        "magic_adapter",
        format!(
            "http get proxy listen_port={} upstream={}:{} path={}",
            state.listen_port,
            upstream.host,
            upstream.port,
            normalize_proxy_path(&uri.0),
        ),
    );
    match state.client.get(endpoint).send().await {
        Ok(response) => {
            let status = response.status();
            let headers = response.headers().clone();
            let body = response.bytes().await.unwrap_or_default();
            (status, headers, body).into_response()
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(json_error(&format!(
                "proxy upstream http get failed: {err}"
            ))),
        )
            .into_response(),
    }
}

async fn proxy_ws(socket: WebSocket, state: AdapterServerState, path_and_query: String) {
    let upstream = match state.upstream.read() {
        Ok(value) => value.clone(),
        Err(_) => return,
    };
    let endpoint = format!("ws://{}:{}{}", upstream.host, upstream.port, path_and_query);
    logger::info(
        "magic_adapter",
        format!(
            "ws proxy connect listen_port={} upstream={}:{} path={}",
            state.listen_port, upstream.host, upstream.port, path_and_query
        ),
    );
    let Ok((upstream_ws, _)) = connect_async(endpoint.as_str()).await else {
        logger::warn(
            "magic_adapter",
            format!(
                "ws proxy connect failed listen_port={} upstream={}:{} path={}",
                state.listen_port, upstream.host, upstream.port, path_and_query
            ),
        );
        return;
    };

    let (mut downstream_tx, mut downstream_rx) = socket.split();
    let (mut upstream_tx, mut upstream_rx) = upstream_ws.split();

    let forward_client = async {
        while let Some(message) = downstream_rx.next().await {
            let Ok(message) = message else {
                logger::warn(
                    "magic_adapter",
                    format!(
                        "ws downstream recv failed listen_port={}",
                        state.listen_port
                    ),
                );
                break;
            };
            log_ws_message("ws downstream recv", state.listen_port, &message);
            let Some(message) = map_downstream_message(message) else {
                break;
            };
            if upstream_tx.send(message).await.is_err() {
                logger::warn(
                    "magic_adapter",
                    format!("ws upstream send failed listen_port={}", state.listen_port),
                );
                break;
            }
        }
    };

    let forward_upstream = async {
        while let Some(message) = upstream_rx.next().await {
            let Ok(message) = message else {
                logger::warn(
                    "magic_adapter",
                    format!("ws upstream recv failed listen_port={}", state.listen_port),
                );
                break;
            };
            log_tungstenite_message("ws upstream recv", state.listen_port, &message);
            let Some(message) = map_upstream_message(message) else {
                break;
            };
            if downstream_tx.send(message).await.is_err() {
                logger::warn(
                    "magic_adapter",
                    format!(
                        "ws downstream send failed listen_port={}",
                        state.listen_port
                    ),
                );
                break;
            }
        }
    };

    tokio::select! {
        _ = forward_client => {}
        _ = forward_upstream => {}
    }
}

fn map_downstream_message(message: AxumWsMessage) -> Option<TungsteniteMessage> {
    match message {
        AxumWsMessage::Text(text) => Some(TungsteniteMessage::Text(text.to_string().into())),
        AxumWsMessage::Binary(binary) => Some(TungsteniteMessage::Binary(binary)),
        AxumWsMessage::Ping(data) => Some(TungsteniteMessage::Ping(data)),
        AxumWsMessage::Pong(data) => Some(TungsteniteMessage::Pong(data)),
        AxumWsMessage::Close(frame) => Some(TungsteniteMessage::Close(frame.map(|value| {
            tokio_tungstenite::tungstenite::protocol::CloseFrame {
                code: value.code.into(),
                reason: value.reason.to_string().into(),
            }
        }))),
    }
}

fn map_upstream_message(message: TungsteniteMessage) -> Option<AxumWsMessage> {
    match message {
        TungsteniteMessage::Text(text) => {
            let rewritten = rewrite_message_text(text.as_str());
            Some(AxumWsMessage::Text(rewritten.into()))
        }
        TungsteniteMessage::Binary(binary) => Some(AxumWsMessage::Binary(binary)),
        TungsteniteMessage::Ping(data) => Some(AxumWsMessage::Ping(data)),
        TungsteniteMessage::Pong(data) => Some(AxumWsMessage::Pong(data)),
        TungsteniteMessage::Close(frame) => Some(AxumWsMessage::Close(frame.map(|value| {
            axum::extract::ws::CloseFrame {
                code: value.code.into(),
                reason: value.reason.to_string().into(),
            }
        }))),
        TungsteniteMessage::Frame(_) => None,
    }
}

fn rewrite_message_text(text: &str) -> String {
    let Ok(mut value) = serde_json::from_str::<Value>(text) else {
        return text.to_string();
    };
    rewrite_bounds_value(&mut value);
    rewrite_float_integers(&mut value);
    serde_json::to_string(&value).unwrap_or_else(|_| text.to_string())
}

fn rewrite_switch_port_value(
    request_payload: &Value,
    response_payload: &mut Value,
    listen_port: u16,
) {
    let Some(command) = request_payload.get("cmd").and_then(Value::as_str) else {
        return;
    };
    if command != "get_switches" {
        return;
    }
    let Some(key) = request_payload.get("key").and_then(Value::as_str) else {
        return;
    };
    if key != "magic-socket-server-port" {
        return;
    }
    let Some(data) = response_payload
        .get_mut("data")
        .and_then(Value::as_object_mut)
    else {
        return;
    };
    data.insert("value".to_string(), Value::String(listen_port.to_string()));
}

fn extract_command_name(payload: &Value) -> Option<String> {
    payload
        .get("cmd")
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn extract_ws_message_type(text: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(text).ok()?;
    value
        .get("type")
        .and_then(Value::as_str)
        .or_else(|| value.get("status").and_then(Value::as_str))
        .map(ToString::to_string)
}

fn should_log_ws_detail(detail: &str) -> bool {
    !matches!(detail, "sync.event" | "sync.inject_event" | "ok")
}

fn log_ws_message(prefix: &str, listen_port: u16, message: &AxumWsMessage) {
    let detail = match message {
        AxumWsMessage::Text(text) => {
            extract_ws_message_type(text).unwrap_or_else(|| "text".to_string())
        }
        AxumWsMessage::Binary(_) => "binary".to_string(),
        AxumWsMessage::Ping(_) => "ping".to_string(),
        AxumWsMessage::Pong(_) => "pong".to_string(),
        AxumWsMessage::Close(_) => "close".to_string(),
    };
    if !should_log_ws_detail(detail.as_str()) {
        return;
    }
    logger::info(
        "magic_adapter",
        format!("{prefix} listen_port={listen_port} kind={detail}"),
    );
}

fn log_tungstenite_message(prefix: &str, listen_port: u16, message: &TungsteniteMessage) {
    let detail = match message {
        TungsteniteMessage::Text(text) => {
            extract_ws_message_type(text.as_str()).unwrap_or_else(|| "text".to_string())
        }
        TungsteniteMessage::Binary(_) => "binary".to_string(),
        TungsteniteMessage::Ping(_) => "ping".to_string(),
        TungsteniteMessage::Pong(_) => "pong".to_string(),
        TungsteniteMessage::Close(_) => "close".to_string(),
        TungsteniteMessage::Frame(_) => "frame".to_string(),
    };
    if !should_log_ws_detail(detail.as_str()) {
        return;
    }
    logger::info(
        "magic_adapter",
        format!("{prefix} listen_port={listen_port} kind={detail}"),
    );
}

fn json_error(message: &str) -> Value {
    serde_json::json!({
        "status": "error",
        "message": message,
    })
}

fn normalize_proxy_path(uri: &axum::http::Uri) -> String {
    uri.path_and_query()
        .map(|value| value.as_str().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "/".to_string())
}

fn reserve_local_port() -> AppResult<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn is_port_open(port: u16) -> bool {
    let Ok(addr) = format!("127.0.0.1:{port}").parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok()
}

/// Convert float values that are whole numbers (e.g. `0.0`, `1.0`) to integers.
/// Chromium sometimes returns integer-typed fields as floats, which causes
/// sidecar deserialization to fail when the schema expects `u64`/`i64`.
fn rewrite_float_integers(value: &mut Value) {
    match value {
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                if f.fract() == 0.0 {
                    if f >= 0.0 {
                        if let Ok(u) = u64::try_from(f as u128) {
                            *value = Value::Number(u.into());
                        }
                    } else if let Some(i) = serde_json::Number::from_f64(f).map(|_| f as i64)
                        .map(serde_json::Number::from)
                    {
                        *value = Value::Number(i);
                    }
                }
            }
        }
        Value::Object(map) => {
            for child in map.values_mut() {
                rewrite_float_integers(child);
            }
        }
        Value::Array(items) => {
            for child in items {
                rewrite_float_integers(child);
            }
        }
        _ => {}
    }
}

fn rewrite_bounds_value(value: &mut Value) {
    match value {
        Value::Object(map) => {
            if let Some(Value::Object(bounds)) = map.get_mut("bounds") {
                if !bounds.contains_key("left") {
                    if let Some(x) = bounds.get("x").cloned() {
                        bounds.insert("left".to_string(), x);
                    }
                }
                if !bounds.contains_key("top") {
                    if let Some(y) = bounds.get("y").cloned() {
                        bounds.insert("top".to_string(), y);
                    }
                }
                // Remove x/y to avoid duplicate field errors when sidecar uses alias
                bounds.remove("x");
                bounds.remove("y");
            }
            for child in map.values_mut() {
                rewrite_bounds_value(child);
            }
        }
        Value::Array(items) => {
            for child in items {
                rewrite_bounds_value(child);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrite_bounds_value_adds_left_and_top_from_x_y() {
        let mut value = serde_json::json!({
            "data": {
                "active_browser": {
                    "bounds": {
                        "x": 37,
                        "y": 52,
                        "width": 1512,
                        "height": 982
                    }
                }
            }
        });

        rewrite_bounds_value(&mut value);

        let bounds = &value["data"]["active_browser"]["bounds"];
        assert_eq!(bounds["left"], 37);
        assert_eq!(bounds["top"], 52);
        assert_eq!(bounds.get("x"), None);
        assert_eq!(bounds.get("y"), None);
    }

    #[test]
    fn rewrite_switch_port_value_uses_adapter_port_for_magic_switch() {
        let request_payload = serde_json::json!({
            "cmd": "get_switches",
            "key": "magic-socket-server-port",
        });
        let mut response_payload = serde_json::json!({
            "status": "ok",
            "data": {
                "key": "magic-socket-server-port",
                "value": "19322",
            }
        });

        rewrite_switch_port_value(&request_payload, &mut response_payload, 61228);

        assert_eq!(response_payload["data"]["value"], "61228");
    }

    #[test]
    fn normalize_proxy_path_preserves_path_and_query() {
        let uri = "/ws?session=1".parse::<axum::http::Uri>().expect("uri");
        assert_eq!(normalize_proxy_path(&uri), "/ws?session=1");
    }

    #[test]
    fn normalize_proxy_path_defaults_to_root() {
        let uri = "/".parse::<axum::http::Uri>().expect("uri");
        assert_eq!(normalize_proxy_path(&uri), "/");
    }

    #[test]
    fn should_log_ws_detail_skips_high_volume_sync_messages() {
        assert!(!should_log_ws_detail("sync.event"));
        assert!(!should_log_ws_detail("sync.inject_event"));
        assert!(!should_log_ws_detail("ok"));
        assert!(should_log_ws_detail("sync.get_status"));
        assert!(should_log_ws_detail("error"));
    }

    #[test]
    fn adapter_router_build_does_not_panic() {
        let state = AdapterServerState {
            listen_port: 61228,
            upstream: Arc::new(RwLock::new(UpstreamTarget {
                host: "127.0.0.1".to_string(),
                port: 19322,
            })),
            client: Client::new(),
        };

        let _ = build_adapter_router(state);
    }
}
