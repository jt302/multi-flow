/// 本机公网 IP 地理定位服务
///
/// 使用 `.no_proxy()` reqwest 客户端直连 ipinfo.io，不走任何系统代理，
/// 确保查询的是本机出口 IP 而非代理出口。
///
/// 结果缓存 15 分钟（进程内）。App 启动时调用 `warm_up()` 预热，
/// profile 启动时调用 `get_cached()` 同步获取（不阻塞）。
use std::env;
use std::net::IpAddr;
use std::collections::HashSet;
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
const DEFAULT_IPAPI_JSON_URL: &str = "https://ipapi.co/json";

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
struct IpInfoResponse {
    ip: Option<String>,
    country: Option<String>,
    #[serde(rename = "country_code")]
    country_code: Option<String>,
    /// "lat,lon" 格式
    loc: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    timezone: Option<String>,
}

struct HostLocaleEndpoint {
    url: String,
    source: &'static str,
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
    let mut errors: Vec<String> = Vec::new();

    let endpoints = resolve_host_locale_urls();
    if endpoints.is_empty() {
        return Err("no host locale query url configured".to_string());
    }

    let direct_client = Client::builder()
        .timeout(FETCH_TIMEOUT)
        .no_proxy()
        .build()
        .map_err(|e| format!("build direct client failed: {e}"))?;
    let proxy_client = Client::builder()
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("build proxy client failed: {e}"))?;

    for endpoint in endpoints {
        let mut attempted_with_proxy = false;

        for (label, client) in [
            ("direct", &direct_client),
            ("system_proxy", &proxy_client),
        ] {
            match fetch_host_locale_response(client, &endpoint.url).await {
                Ok(resp) => match build_host_locale_suggestion(resp, endpoint.source) {
                    Ok(suggestion) => {
                        if label == "system_proxy" {
                            crate::logger::warn(
                                "host_locale",
                                format!(
                                    "系统代理路径获取到 host locale，来源 {}",
                                    endpoint.source
                                ),
                            );
                        }
                        return Ok(suggestion);
                    }
                    Err(err) => {
                        let msg = format!(
                            "{} response format invalid via {}: {}",
                            endpoint.source, label, err
                        );
                        errors.push(msg.clone());
                        crate::logger::warn("host_locale", msg);
                    }
                },
                Err(err) => {
                    attempted_with_proxy = true;
                    let msg = format!(
                        "{} 请求失败 via {} url={} err={}",
                        endpoint.source, label, endpoint.url, err
                    );
                    errors.push(msg.clone());
                    crate::logger::warn("host_locale", msg);
                }
            }

            if !attempted_with_proxy && label == "direct" {
                // 直连失败后再尝试走系统代理，避免 no_proxy 场景下全量失败
                continue;
            }
        }
    }

    Err(format!(
        "所有 IP 地理查询 URL 均失败: {}",
        errors.join(" ; ")
    ))
}

async fn fetch_host_locale_response(
    client: &Client,
    url: &str,
) -> Result<IpInfoResponse, String> {
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
    if let Ok(parsed) = serde_json::from_str::<IpInfoResponse>(&body) {
        if parsed.ip.as_deref().and_then(trim_str).and_then(|ip| ip.parse::<IpAddr>().ok()).is_some() {
            return Ok(parsed);
        }
    }

    // 纯 IP 文本响应（ipify / ip.sb / ifconfig.me 等）
    let ip_str = body.lines().next().and_then(trim_str).ok_or("empty response")?;
    ip_str.parse::<IpAddr>().map_err(|e| e.to_string())?;
    Ok(IpInfoResponse {
        ip: Some(ip_str.to_string()),
        country: None,
        loc: None,
        country_code: None,
        latitude: None,
        longitude: None,
        timezone: None,
    })
}

fn resolve_host_locale_urls() -> Vec<HostLocaleEndpoint> {
    let mut endpoints = Vec::new();
    let mut seen_urls = HashSet::new();

    if let Ok(custom) = env::var(IPINFO_URL_ENV) {
        if let Some(v) = trim_str(&custom) {
            push_host_locale_endpoint(
                &mut endpoints,
                &mut seen_urls,
                v.to_string(),
                "ipinfo",
            );
        }
    }
    if let Ok(token) = env::var(IPINFO_TOKEN_ENV) {
        if let Some(v) = trim_str(&token) {
            push_host_locale_endpoint(
                &mut endpoints,
                &mut seen_urls,
                format!("{DEFAULT_IPINFO_LITE_URL}?token={v}"),
                "ipinfo",
            );
        }
    }
    push_host_locale_endpoint(
        &mut endpoints,
        &mut seen_urls,
        DEFAULT_IPINFO_JSON_URL.to_string(),
        "ipinfo",
    );
    push_host_locale_endpoint(
        &mut endpoints,
        &mut seen_urls,
        DEFAULT_IPAPI_JSON_URL.to_string(),
        "ipapi",
    );
    endpoints
}

fn build_host_locale_suggestion(
    response: IpInfoResponse,
    source: &str,
) -> Result<HostLocaleSuggestion, String> {
    let exit_ip = response
        .ip
        .as_deref()
        .and_then(trim_str)
        .and_then(|ip| ip.parse::<IpAddr>().ok())
        .map(|value| value.to_string());

    let country = response
        .country
        .as_deref()
        .and_then(trim_str)
        .map(str::to_uppercase)
        .or_else(|| {
            response
                .country_code
                .as_deref()
                .and_then(trim_str)
                .map(str::to_uppercase)
        });

    let exit_ip = match exit_ip {
        Some(value) => value,
        None => return Err("missing valid ip value".to_string()),
    };

    let language = country
        .as_deref()
        .and_then(default_language_for_country);
    let timezone = response
        .timezone
        .as_deref()
        .and_then(trim_str)
        .map(str::to_string)
        .or_else(|| country.as_deref().and_then(default_timezone_for_country));
    let (latitude, longitude) = parse_coordinates(&response);

    Ok(HostLocaleSuggestion {
        exit_ip: Some(exit_ip),
        country,
        language,
        timezone,
        latitude,
        longitude,
        source: source.to_string(),
    })
}

fn parse_coordinates(response: &IpInfoResponse) -> (Option<f64>, Option<f64>) {
    if response.latitude.is_some() || response.longitude.is_some() {
        return (response.latitude, response.longitude);
    }
    parse_loc(response.loc.as_deref())
}

fn push_host_locale_endpoint(
    endpoints: &mut Vec<HostLocaleEndpoint>,
    seen_urls: &mut HashSet<String>,
    url: String,
    source: &'static str,
) {
    if seen_urls.insert(url.clone()) {
        endpoints.push(HostLocaleEndpoint { url, source });
    }
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
