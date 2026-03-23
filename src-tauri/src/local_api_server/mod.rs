use std::collections::HashMap;
use std::net::TcpListener;
use std::time::Duration;

use reqwest::{Client, Proxy as ReqwestProxy};
use serde::Serialize;
use serde_json::Value;

use crate::logger;
use crate::models::{now_ts, LocalApiServerStatus, Proxy};

pub const DEFAULT_PROXY_DAEMON_BIND_ADDRESS: &str = "127.0.0.1:18180";
const PROXY_RUNTIME_PROBE_URLS: [&str; 2] = [
    "https://api.ipify.org?format=json",
    "https://www.google.com/generate_204",
];

#[derive(Debug, Clone)]
struct ProxyRuntimeInstance {
    proxy_id: String,
    proxy_type: String,
    listen_port: u16,
}

#[derive(Debug, Serialize)]
struct ProxyStartRequest {
    listen_port: u16,
    proxy_type: String,
    proxy_host: String,
    proxy_port: u16,
    username: Option<String>,
    password: Option<String>,
}

pub struct LocalApiServer {
    bind_address: String,
    running: bool,
    started_at: Option<i64>,
    client: Client,
    proxy_runtime_instances: HashMap<String, ProxyRuntimeInstance>,
}

impl LocalApiServer {
    pub fn new(bind_address: impl Into<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            bind_address: bind_address.into(),
            running: false,
            started_at: None,
            client,
            proxy_runtime_instances: HashMap::new(),
        }
    }

    pub fn mark_started(&mut self) {
        if !self.running {
            self.running = true;
            self.started_at = Some(now_ts());
        }
    }

    pub fn bind_address(&self) -> &str {
        self.bind_address.as_str()
    }

    pub fn bind_port(&self) -> Result<u16, String> {
        self.bind_address
            .rsplit(':')
            .next()
            .ok_or_else(|| "invalid daemon bind address: missing port".to_string())
            .and_then(|value| {
                value
                    .parse::<u16>()
                    .map_err(|err| format!("invalid daemon bind address port: {err}"))
            })
    }

    pub fn check_daemon_health(&self) -> bool {
        let endpoint = format!("http://{}/proxy/list", self.bind_address);
        crate::runtime_compat::block_on_compat(async {
            self.client
                .get(endpoint)
                .send()
                .await
                .map(|response| response.status().is_success())
                .unwrap_or(false)
        })
    }

    pub fn start_proxy_runtime(
        &mut self,
        profile_id: &str,
        proxy: &Proxy,
    ) -> Result<String, String> {
        self.mark_started();
        if let Some(runtime) = self.proxy_runtime_instances.get(profile_id) {
            if runtime.proxy_id == proxy.id {
                return Ok(build_daemon_proxy_server(
                    runtime.proxy_type.as_str(),
                    runtime.listen_port,
                ));
            }
            let _ = self.stop_proxy_runtime(profile_id);
        }

        let proxy_type = normalize_proxy_type_for_daemon(&proxy.protocol)?;
        let proxy_port = u16::try_from(proxy.port).map_err(|_| {
            format!(
                "invalid proxy port for daemon launch: {} (expected 1..65535)",
                proxy.port
            )
        })?;
        if proxy_port == 0 {
            return Err("invalid proxy port for daemon launch: 0 (expected 1..65535)".to_string());
        }
        let username = proxy.username.clone().and_then(trim_to_option);
        let password = proxy.password.clone().and_then(trim_to_option);
        if username.is_some() ^ password.is_some() {
            return Err(
                "proxy daemon requires username and password to be both set or both empty"
                    .to_string(),
            );
        }
        let listen_port = reserve_local_port()?;
        let request = ProxyStartRequest {
            listen_port,
            proxy_type: proxy_type.clone(),
            proxy_host: proxy.host.clone(),
            proxy_port,
            username,
            password,
        };
        logger::info(
            "proxy_daemon",
            format!(
                "start request profile_id={} proxy_id={} type={} host={} port={} listen_port={} has_auth={}",
                profile_id,
                proxy.id,
                request.proxy_type,
                request.proxy_host,
                request.proxy_port,
                request.listen_port,
                request.username.is_some(),
            ),
        );
        let endpoint = format!("http://{}/proxy/start", self.bind_address);
        let (status, body) = crate::runtime_compat::block_on_compat(async {
            let response = self
                .client
                .post(endpoint)
                .json(&request)
                .send()
                .await
                .map_err(|err| format!("proxy daemon start request failed: {err}"))?;
            let status = response.status();
            let body = response
                .text()
                .await
                .map_err(|err| format!("proxy daemon start response read failed: {err}"))?;
            Ok::<_, String>((status, body))
        })?;
        logger::info(
            "proxy_daemon",
            format!(
                "start response profile_id={} proxy_id={} status={} body={}",
                profile_id,
                proxy.id,
                status.as_u16(),
                if body.trim().is_empty() {
                    "<empty>"
                } else {
                    body.as_str()
                }
            ),
        );
        if !status.is_success() {
            let reason = describe_proxy_daemon_http_error(status.as_u16(), &body);
            return Err(format!(
                "proxy daemon start failed status={} reason={reason}",
                status.as_u16(),
            ));
        }
        let resolved_port = parse_listen_port_from_response(&body).unwrap_or(listen_port);
        self.proxy_runtime_instances.insert(
            profile_id.to_string(),
            ProxyRuntimeInstance {
                proxy_id: proxy.id.clone(),
                proxy_type: proxy_type.clone(),
                listen_port: resolved_port,
            },
        );
        let proxy_server = build_daemon_proxy_server(proxy_type.as_str(), resolved_port);
        if let Err(err) = self.verify_proxy_runtime(&proxy_server) {
            let _ = self.stop_proxy_runtime(profile_id);
            return Err(format!("proxy runtime upstream probe failed: {err}"));
        }
        Ok(proxy_server)
    }

    pub fn stop_proxy_runtime(&mut self, profile_id: &str) -> Result<(), String> {
        let Some(runtime) = self.proxy_runtime_instances.remove(profile_id) else {
            return Ok(());
        };
        let endpoint = format!(
            "http://{}/proxy/stop?port={}",
            self.bind_address, runtime.listen_port
        );
        logger::info(
            "proxy_daemon",
            format!(
                "stop request profile_id={} proxy_id={} listen_port={}",
                profile_id, runtime.proxy_id, runtime.listen_port
            ),
        );
        let (status, body) = crate::runtime_compat::block_on_compat(async {
            let response = self
                .client
                .post(endpoint)
                .send()
                .await
                .map_err(|err| format!("proxy daemon stop request failed: {err}"))?;
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "read body failed".to_string());
            Ok::<_, String>((status, body))
        })?;
        logger::info(
            "proxy_daemon",
            format!(
                "stop response profile_id={} proxy_id={} status={}",
                profile_id,
                runtime.proxy_id,
                status.as_u16()
            ),
        );
        if !status.is_success() {
            return Err(format!(
                "proxy daemon stop failed status={} body={body}",
                status.as_u16()
            ));
        }
        Ok(())
    }

    pub fn status(&self) -> LocalApiServerStatus {
        LocalApiServerStatus {
            running: self.running,
            bind_address: self.bind_address.clone(),
            started_at: self.started_at,
        }
    }

    fn verify_proxy_runtime(&self, proxy_server: &str) -> Result<(), String> {
        let proxy = ReqwestProxy::all(proxy_server)
            .map_err(|err| format!("build proxy probe config failed: {err}"))?;
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .proxy(proxy)
            .build()
            .map_err(|err| format!("build proxy probe client failed: {err}"))?;

        crate::runtime_compat::block_on_compat(async move {
            let mut last_error = None;
            for url in PROXY_RUNTIME_PROBE_URLS {
                match client.get(url).send().await {
                    Ok(response) if response.status().is_success() => return Ok(()),
                    Ok(response) => {
                        last_error = Some(format!(
                            "probe {} returned status {}",
                            url,
                            response.status().as_u16()
                        ));
                    }
                    Err(err) => {
                        last_error = Some(format!("probe {} failed: {err}", url));
                    }
                }
            }

            Err(last_error.unwrap_or_else(|| "proxy runtime probe failed".to_string()))
        })
    }
}

fn reserve_local_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|err| format!("reserve local port failed: {err}"))?;
    let port = listener
        .local_addr()
        .map_err(|err| format!("resolve reserved local port failed: {err}"))?
        .port();
    Ok(port)
}

fn parse_listen_port_from_response(body: &str) -> Option<u16> {
    let payload: Value = serde_json::from_str(body).ok()?;
    let root = payload.as_object()?;
    find_port_in_object(root).or_else(|| {
        root.get("data")
            .and_then(|value| value.as_object())
            .and_then(find_port_in_object)
    })
}

fn find_port_in_object(object: &serde_json::Map<String, Value>) -> Option<u16> {
    ["listen_port", "listenPort", "port"]
        .iter()
        .find_map(|key| parse_port_value(object.get(*key)?))
}

fn parse_port_value(value: &Value) -> Option<u16> {
    match value {
        Value::Number(number) => number.as_u64().and_then(|port| u16::try_from(port).ok()),
        Value::String(text) => text.trim().parse::<u16>().ok(),
        _ => None,
    }
}

fn normalize_proxy_type_for_daemon(protocol: &str) -> Result<String, String> {
    match protocol.trim().to_ascii_lowercase().as_str() {
        "http" => Ok("http".to_string()),
        "socks5" => Ok("socks5".to_string()),
        "https" => {
            Err("proxy daemon v2 does not support https proxy_type, use http or socks5".to_string())
        }
        "ssh" => Err("proxy daemon does not support ssh transport for chromium launch".to_string()),
        other => Err(format!(
            "unsupported proxy protocol for daemon launch: {other} (allowed: http, socks5)"
        )),
    }
}

fn trim_to_option(input: String) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn describe_proxy_daemon_http_error(status: u16, body: &str) -> String {
    let body = body.trim();
    if !body.is_empty() {
        return body.to_string();
    }
    match status {
        400 => "daemon rejected request (check proxy_type and username/password pair)".to_string(),
        422 => "daemon rejected payload shape (check JSON field types)".to_string(),
        _ => "daemon returned empty error response".to_string(),
    }
}

fn build_daemon_proxy_server(proxy_type: &str, listen_port: u16) -> String {
    format!("{proxy_type}://127.0.0.1:{listen_port}")
}
