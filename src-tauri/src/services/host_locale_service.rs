/// 本机公网 IP 地理定位服务
///
/// 使用 `.no_proxy()` reqwest 客户端直连 ipinfo.io，不走任何系统代理，
/// 确保查询的是本机出口 IP 而非代理出口。
///
/// 结果缓存 15 分钟（进程内）。App 启动时调用 `warm_up()` 预热，
/// profile 启动时调用 `get_cached()` 同步获取（不阻塞）。
use std::env;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use reqwest::Client;
use serde::Deserialize;

use crate::services::locale_catalog::{default_language_for_country, default_timezone_for_country};

const CACHE_TTL: Duration = Duration::from_secs(15 * 60);
const FETCH_TIMEOUT: Duration = Duration::from_millis(1500);
const IPINFO_TOKEN_ENV: &str = "MULTI_FLOW_IPINFO_TOKEN";
const IPINFO_URL_ENV: &str = "MULTI_FLOW_IPINFO_URL";
const DEFAULT_IPINFO_JSON_URL: &str = "https://ipinfo.io/json";
const DEFAULT_IPINFO_LITE_URL: &str = "https://api.ipinfo.io/lite/me";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostLocaleSuggestion {
    pub exit_ip: Option<String>,
    pub country: Option<String>,
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    /// 数据来源："ipinfo" | "none"
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct IpInfoFullResponse {
    ip: Option<String>,
    country: Option<String>,
    /// "lat,lon" 格式
    loc: Option<String>,
    timezone: Option<String>,
}

struct CacheState {
    value: Option<HostLocaleSuggestion>,
    fetched_at: Option<Instant>,
    in_flight: bool,
}

#[derive(Clone)]
pub struct HostLocaleService {
    inner: Arc<Mutex<CacheState>>,
}

impl HostLocaleService {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(CacheState {
                value: None,
                fetched_at: None,
                in_flight: false,
            })),
        }
    }

    /// 同步获取缓存（不阻塞）。缓存有效则返回值，否则返回 None。
    pub fn get_cached(&self) -> Option<HostLocaleSuggestion> {
        let guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        let fetched_at = guard.fetched_at?;
        if fetched_at.elapsed() < CACHE_TTL {
            guard.value.clone()
        } else {
            None
        }
    }

    /// 异步预热：启动时调用，后台查询本机 IP 并写入缓存。
    /// 若已有 in-flight 请求则不重复发起。
    pub async fn warm_up(&self) {
        {
            let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
            if guard.in_flight {
                return;
            }
            // 缓存未过期则跳过
            if let Some(fetched_at) = guard.fetched_at {
                if fetched_at.elapsed() < CACHE_TTL {
                    return;
                }
            }
            guard.in_flight = true;
        }

        let result = fetch_host_locale().await;

        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        guard.in_flight = false;
        guard.fetched_at = Some(Instant::now());
        guard.value = Some(result);
    }

    /// 立即发起查询（忽略缓存），用于 Tauri command 强制刷新。
    pub async fn fetch_now(&self) -> HostLocaleSuggestion {
        let result = fetch_host_locale().await;
        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        guard.fetched_at = Some(Instant::now());
        guard.value = Some(result.clone());
        result
    }
}

async fn fetch_host_locale() -> HostLocaleSuggestion {
    match try_fetch_host_locale().await {
        Ok(suggestion) => suggestion,
        Err(err) => {
            crate::logger::warn(
                "host_locale",
                format!("本机 IP 地理查询失败，返回空建议: {err}"),
            );
            HostLocaleSuggestion {
                exit_ip: None,
                country: None,
                language: None,
                timezone: None,
                latitude: None,
                longitude: None,
                source: "none".to_string(),
            }
        }
    }
}

async fn try_fetch_host_locale() -> Result<HostLocaleSuggestion, String> {
    let client = Client::builder()
        .timeout(FETCH_TIMEOUT)
        .no_proxy() // 硬要求：不走任何系统代理，查的是本机真实出口
        .build()
        .map_err(|e| format!("build client failed: {e}"))?;

    for url in resolve_host_locale_urls() {
        match fetch_ipinfo_response(&client, &url).await {
            Ok(resp) => {
                let country = resp.country.as_deref().and_then(trim_str).map(str::to_uppercase);
                let language = country
                    .as_deref()
                    .and_then(default_language_for_country);
                let timezone = resp
                    .timezone
                    .as_deref()
                    .and_then(trim_str)
                    .map(str::to_string)
                    .or_else(|| country.as_deref().and_then(default_timezone_for_country));
                let (latitude, longitude) = parse_loc(resp.loc.as_deref());
                return Ok(HostLocaleSuggestion {
                    exit_ip: resp.ip.as_deref().and_then(trim_str).map(str::to_string),
                    country,
                    language,
                    timezone,
                    latitude,
                    longitude,
                    source: "ipinfo".to_string(),
                });
            }
            Err(err) => {
                crate::logger::warn(
                    "host_locale",
                    format!("ipinfo 请求失败 url={url} err={err}"),
                );
            }
        }
    }

    Err("所有 IP 地理查询 URL 均失败".to_string())
}

async fn fetch_ipinfo_response(
    client: &Client,
    url: &str,
) -> Result<IpInfoFullResponse, String> {
    let response = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    let body = response.text().await.map_err(|e| e.to_string())?;

    // 尝试完整响应解析
    if let Ok(parsed) = serde_json::from_str::<IpInfoFullResponse>(&body) {
        if parsed.ip.as_deref().and_then(trim_str).and_then(|ip| ip.parse::<IpAddr>().ok()).is_some() {
            return Ok(parsed);
        }
    }

    // 纯 IP 文本响应（ipify / ip.sb / ifconfig.me 等）
    let ip_str = body.lines().next().and_then(trim_str).ok_or("empty response")?;
    ip_str.parse::<IpAddr>().map_err(|e| e.to_string())?;
    Ok(IpInfoFullResponse {
        ip: Some(ip_str.to_string()),
        country: None,
        loc: None,
        timezone: None,
    })
}

fn resolve_host_locale_urls() -> Vec<String> {
    let mut urls = Vec::new();

    if let Ok(custom) = env::var(IPINFO_URL_ENV) {
        if let Some(v) = trim_str(&custom) {
            urls.push(v.to_string());
        }
    }
    if let Ok(token) = env::var(IPINFO_TOKEN_ENV) {
        if let Some(v) = trim_str(&token) {
            urls.push(format!("{DEFAULT_IPINFO_LITE_URL}?token={v}"));
        }
    }
    urls.push(DEFAULT_IPINFO_JSON_URL.to_string());
    urls
}

fn parse_loc(loc: Option<&str>) -> (Option<f64>, Option<f64>) {
    let loc = match loc.and_then(trim_str) {
        Some(v) => v,
        None => return (None, None),
    };
    let mut parts = loc.splitn(2, ',');
    let lat = parts.next().and_then(|s| s.trim().parse::<f64>().ok());
    let lon = parts.next().and_then(|s| s.trim().parse::<f64>().ok());
    (lat, lon)
}

fn trim_str(s: &str) -> Option<&str> {
    let trimmed = s.trim();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}
