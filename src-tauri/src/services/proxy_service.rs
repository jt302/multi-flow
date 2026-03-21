use std::collections::HashMap;
use std::env;
use std::future::Future;
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::{Duration, Instant};

use maxminddb::Reader;
use reqwest::{Client, Proxy as ReqwestProxy};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set,
};
use serde::{Deserialize, Serialize};

use crate::db::entities::{profile, profile_proxy_binding, proxy};
use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{
    now_ts, BatchCheckProxiesRequest, BatchProxyActionItem, BatchProxyActionResponse,
    CreateProxyRequest, GeolocationOverride, ImportProxiesRequest, ListProxiesQuery,
    ListProxiesResponse, ProfileProxyBinding, Proxy, ProxyLifecycle, ProxyTargetSiteCheck,
    UpdateProxyRequest,
};

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";
const SUPPORTED_PROTOCOLS: &[&str] = &["http", "https", "socks5", "ssh"];
const DEFAULT_PAGE: u64 = 1;
const DEFAULT_PAGE_SIZE: u64 = 50;
const MAX_PAGE_SIZE: u64 = 200;
const CHECK_STATUS_UNKNOWN: &str = "unknown";
const CHECK_STATUS_OK: &str = "ok";
const CHECK_STATUS_ERROR: &str = "error";
const CHECK_STATUS_UNSUPPORTED: &str = "unsupported";
const DEFAULT_IPINFO_JSON_URL: &str = "https://ipinfo.io/json";
const DEFAULT_IPINFO_LITE_URL: &str = "https://api.ipinfo.io/lite/me";
const DEFAULT_IPIFY_JSON_URL: &str = "https://api.ipify.org?format=json";
const DEFAULT_IPIFY64_JSON_URL: &str = "https://api64.ipify.org?format=json";
const DEFAULT_IP_SB_TEXT_URL: &str = "https://api.ip.sb/ip";
const DEFAULT_IFCONFIG_TEXT_URL: &str = "https://ifconfig.me/ip";
const IPINFO_TOKEN_ENV: &str = "MULTI_FLOW_IPINFO_TOKEN";
const IPINFO_URL_ENV: &str = "MULTI_FLOW_IPINFO_URL";
const TARGET_SITE_CHECK_TIMEOUT_SECS: u64 = 8;
const TARGET_SITE_GOOGLE: &str = "google.com";
const TARGET_SITE_YOUTUBE: &str = "youtube.com";
const TARGET_SITE_CHECK_TARGETS: [(&str, &str); 2] = [
    (TARGET_SITE_GOOGLE, "https://www.google.com"),
    (TARGET_SITE_YOUTUBE, "https://www.youtube.com"),
];
const PROXY_VALUE_SOURCE_IP: &str = "ip";
const PROXY_VALUE_SOURCE_CUSTOM: &str = "custom";

#[derive(Debug, Clone)]
struct ProxyCheckSnapshot {
    check_status: String,
    check_message: Option<String>,
    target_site_checks: Option<Vec<ProxyTargetSiteCheck>>,
    exit_ip: Option<String>,
    country: Option<String>,
    region: Option<String>,
    city: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    geo_accuracy_meters: Option<f64>,
    suggested_language: Option<String>,
    suggested_timezone: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct ProxyConnectivitySnapshot {
    latency_ms: u64,
}

#[derive(Debug, Clone)]
struct ProxyLocaleSettings {
    language_source: String,
    custom_language: Option<String>,
    effective_language: Option<String>,
    timezone_source: String,
    custom_timezone: Option<String>,
    effective_timezone: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawTargetSiteCheck {
    site: String,
    reachable: bool,
    status_code: Option<u16>,
    latency_ms: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IpInfoResponse {
    ip: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeoIpCityRecord {
    country: Option<GeoIpNameRecord>,
    city: Option<GeoIpNameRecord>,
    subdivisions: Option<Vec<GeoIpNameRecord>>,
    location: Option<GeoIpLocation>,
}

#[derive(Debug, Deserialize)]
struct GeoIpNameRecord {
    iso_code: Option<String>,
    names: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct GeoIpLocation {
    latitude: Option<f64>,
    longitude: Option<f64>,
    accuracy_radius: Option<u16>,
    time_zone: Option<String>,
}

#[derive(Clone)]
pub struct ProxyService {
    db: DatabaseConnection,
}

impl ProxyService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_proxy(&self, req: CreateProxyRequest) -> AppResult<Proxy> {
        let name = require_non_empty("name", &req.name)?;
        let protocol = normalize_protocol(&req.protocol)?;
        let host = require_non_empty("host", &req.host)?;
        let port = validate_port(req.port)?;
        let locale_settings = normalize_proxy_locale_settings(
            req.language_source,
            req.custom_language,
            None,
            req.timezone_source,
            req.custom_timezone,
            None,
        )?;
        let now = now_ts();

        let model = proxy::ActiveModel {
            name: Set(name),
            protocol: Set(protocol),
            host: Set(host),
            port: Set(port),
            username: Set(trim_option(req.username)),
            password: Set(trim_option(req.password)),
            country: Set(None),
            region: Set(None),
            city: Set(None),
            provider: Set(trim_option(req.provider)),
            note: Set(trim_option(req.note)),
            check_status: Set(Some(CHECK_STATUS_UNKNOWN.to_string())),
            check_message: Set(None),
            last_checked_at: Set(None),
            exit_ip: Set(None),
            latitude: Set(None),
            longitude: Set(None),
            geo_accuracy_meters: Set(None),
            suggested_language: Set(None),
            suggested_timezone: Set(None),
            language_source: Set(Some(locale_settings.language_source)),
            custom_language: Set(locale_settings.custom_language),
            effective_language: Set(locale_settings.effective_language),
            timezone_source: Set(Some(locale_settings.timezone_source)),
            custom_timezone: Set(locale_settings.custom_timezone),
            effective_timezone: Set(locale_settings.effective_timezone),
            target_site_checks_json: Set(None),
            expires_at: Set(req.expires_at),
            lifecycle: Set(LIFECYCLE_ACTIVE.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            deleted_at: Set(None),
            ..Default::default()
        };

        let inserted = self.db_query(proxy::Entity::insert(model).exec(&self.db))?;
        let created = self.find_proxy_model_by_pk(inserted.last_insert_id)?;
        Ok(to_api_proxy(created))
    }

    pub fn update_proxy(&self, proxy_id: &str, req: UpdateProxyRequest) -> AppResult<Proxy> {
        let stored = self.find_proxy_model(proxy_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "proxy already deleted: {proxy_id}"
            )));
        }

        let locale_settings = normalize_proxy_locale_settings(
            req.language_source
                .or_else(|| stored.language_source.clone()),
            req.custom_language
                .or_else(|| stored.custom_language.clone()),
            stored.suggested_language.clone(),
            req.timezone_source
                .or_else(|| stored.timezone_source.clone()),
            req.custom_timezone
                .or_else(|| stored.custom_timezone.clone()),
            stored.suggested_timezone.clone(),
        )?;
        let mut active_model: proxy::ActiveModel = stored.into();
        if let Some(name) = req.name {
            active_model.name = Set(require_non_empty("name", &name)?);
        }
        if let Some(protocol) = req.protocol {
            active_model.protocol = Set(normalize_protocol(&protocol)?);
        }
        if let Some(username) = req.username {
            active_model.username = Set(trim_string_value(username));
        }
        if let Some(password) = req.password {
            active_model.password = Set(trim_string_value(password));
        }
        if let Some(provider) = req.provider {
            active_model.provider = Set(trim_string_value(provider));
        }
        if let Some(note) = req.note {
            active_model.note = Set(trim_string_value(note));
        }
        if let Some(expires_at) = req.expires_at {
            active_model.expires_at = Set((expires_at > 0).then_some(expires_at));
        }
        active_model.language_source = Set(Some(locale_settings.language_source));
        active_model.custom_language = Set(locale_settings.custom_language);
        active_model.effective_language = Set(locale_settings.effective_language);
        active_model.timezone_source = Set(Some(locale_settings.timezone_source));
        active_model.custom_timezone = Set(locale_settings.custom_timezone);
        active_model.effective_timezone = Set(locale_settings.effective_timezone);
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(to_api_proxy(updated))
    }

    pub fn list_proxies(&self, params: ListProxiesQuery) -> AppResult<ListProxiesResponse> {
        let page = normalize_page(params.page);
        let page_size = normalize_page_size(params.page_size);
        let mut query = proxy::Entity::find();
        if !params.include_deleted {
            query = query.filter(proxy::Column::Lifecycle.eq(LIFECYCLE_ACTIVE));
        }

        if let Some(keyword) = trim_option(params.keyword) {
            let condition = Condition::any()
                .add(proxy::Column::Name.contains(&keyword))
                .add(proxy::Column::Host.contains(&keyword))
                .add(proxy::Column::Provider.contains(&keyword))
                .add(proxy::Column::Note.contains(&keyword));
            query = query.filter(condition);
        }

        if let Some(protocol) = trim_option(params.protocol) {
            let protocol = normalize_protocol(&protocol)?;
            query = query.filter(proxy::Column::Protocol.eq(protocol));
        }

        if let Some(country) = trim_option(params.country) {
            query = query.filter(proxy::Column::Country.eq(country));
        }

        if let Some(check_status) = trim_option(params.check_status) {
            query = query.filter(proxy::Column::CheckStatus.eq(check_status));
        }

        let paginator = query
            .order_by_asc(proxy::Column::CreatedAt)
            .paginate(&self.db, page_size);
        let pages = self.db_query(paginator.num_items_and_pages())?;
        let items = self.db_query(paginator.fetch_page(page.saturating_sub(1)))?;
        let items: Vec<Proxy> = items.into_iter().map(to_api_proxy).collect();

        Ok(ListProxiesResponse {
            total: pages.number_of_items as usize,
            items,
            page,
            page_size,
            total_pages: pages.number_of_pages,
        })
    }

    pub fn soft_delete_proxy(&self, proxy_id: &str) -> AppResult<Proxy> {
        let stored = self.find_proxy_model(proxy_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "proxy already deleted: {proxy_id}"
            )));
        }

        let now = now_ts();
        let mut active_model: proxy::ActiveModel = stored.into();
        active_model.lifecycle = Set(LIFECYCLE_DELETED.to_string());
        active_model.deleted_at = Set(Some(now));
        active_model.updated_at = Set(now);
        let updated = self.db_query(active_model.update(&self.db))?;

        self.db_query(
            profile_proxy_binding::Entity::delete_many()
                .filter(profile_proxy_binding::Column::ProxyId.eq(updated.id))
                .exec(&self.db),
        )?;

        Ok(to_api_proxy(updated))
    }

    pub fn batch_update_proxies(
        &self,
        proxy_ids: Vec<String>,
        req: UpdateProxyRequest,
    ) -> AppResult<BatchProxyActionResponse> {
        if proxy_ids.is_empty() {
            return Err(AppError::Validation(
                "proxy_ids must not be empty".to_string(),
            ));
        }

        let total = proxy_ids.len();
        let mut success_count = 0usize;
        let mut items = Vec::with_capacity(total);
        for proxy_id in proxy_ids {
            match self.update_proxy(&proxy_id, req.clone()) {
                Ok(_) => {
                    success_count += 1;
                    items.push(BatchProxyActionItem {
                        proxy_id,
                        ok: true,
                        message: "updated".to_string(),
                    });
                }
                Err(err) => items.push(BatchProxyActionItem {
                    proxy_id,
                    ok: false,
                    message: err.to_string(),
                }),
            }
        }

        Ok(BatchProxyActionResponse {
            total,
            success_count,
            failed_count: total.saturating_sub(success_count),
            items,
        })
    }

    pub fn batch_delete_proxies(
        &self,
        proxy_ids: Vec<String>,
    ) -> AppResult<BatchProxyActionResponse> {
        if proxy_ids.is_empty() {
            return Err(AppError::Validation(
                "proxy_ids must not be empty".to_string(),
            ));
        }

        let total = proxy_ids.len();
        let mut success_count = 0usize;
        let mut items = Vec::with_capacity(total);
        for proxy_id in proxy_ids {
            match self.soft_delete_proxy(&proxy_id) {
                Ok(_) => {
                    success_count += 1;
                    items.push(BatchProxyActionItem {
                        proxy_id,
                        ok: true,
                        message: "deleted".to_string(),
                    });
                }
                Err(err) => items.push(BatchProxyActionItem {
                    proxy_id,
                    ok: false,
                    message: err.to_string(),
                }),
            }
        }

        Ok(BatchProxyActionResponse {
            total,
            success_count,
            failed_count: total.saturating_sub(success_count),
            items,
        })
    }

    pub fn import_proxies(&self, req: ImportProxiesRequest) -> AppResult<BatchProxyActionResponse> {
        let protocol = normalize_protocol(&req.protocol)?;
        if req.lines.is_empty() {
            return Err(AppError::Validation("lines must not be empty".to_string()));
        }

        let mut items = Vec::with_capacity(req.lines.len());
        let mut success_count = 0usize;
        for raw_line in req.lines {
            let line = raw_line.trim();
            if line.is_empty() {
                items.push(BatchProxyActionItem {
                    proxy_id: String::new(),
                    ok: false,
                    message: "empty line".to_string(),
                });
                continue;
            }
            match parse_import_line(line) {
                Ok(parsed) => {
                    let name = format!("{}:{}", parsed.host, parsed.port);
                    match self.create_proxy(CreateProxyRequest {
                        name,
                        protocol: protocol.clone(),
                        host: parsed.host,
                        port: parsed.port,
                        username: parsed.username,
                        password: parsed.password,
                        provider: None,
                        note: None,
                        expires_at: None,
                        language_source: None,
                        custom_language: None,
                        timezone_source: None,
                        custom_timezone: None,
                    }) {
                        Ok(proxy) => {
                            success_count += 1;
                            items.push(BatchProxyActionItem {
                                proxy_id: proxy.id,
                                ok: true,
                                message: "imported".to_string(),
                            });
                        }
                        Err(err) => items.push(BatchProxyActionItem {
                            proxy_id: String::new(),
                            ok: false,
                            message: err.to_string(),
                        }),
                    }
                }
                Err(err) => items.push(BatchProxyActionItem {
                    proxy_id: String::new(),
                    ok: false,
                    message: err.to_string(),
                }),
            }
        }

        Ok(BatchProxyActionResponse {
            total: items.len(),
            success_count,
            failed_count: items.len().saturating_sub(success_count),
            items,
        })
    }

    pub fn check_proxy(&self, proxy_id: &str, geoip_database_path: &Path) -> AppResult<Proxy> {
        self.check_proxy_with(proxy_id, |stored| {
            self.perform_proxy_check(stored, geoip_database_path)
        })
    }

    fn check_proxy_with<F>(&self, proxy_id: &str, checker: F) -> AppResult<Proxy>
    where
        F: FnOnce(&proxy::Model) -> AppResult<ProxyCheckSnapshot>,
    {
        let stored = self.find_proxy_model(proxy_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "proxy already deleted: {proxy_id}"
            )));
        }

        let snapshot = match checker(&stored) {
            Ok(snapshot) => snapshot,
            Err(err) => ProxyCheckSnapshot {
                check_status: CHECK_STATUS_ERROR.to_string(),
                check_message: Some(humanize_proxy_check_error(&err)),
                target_site_checks: None,
                exit_ip: None,
                country: None,
                region: None,
                city: None,
                latitude: None,
                longitude: None,
                geo_accuracy_meters: None,
                suggested_language: None,
                suggested_timezone: None,
            },
        };
        let updated = self.persist_proxy_check_snapshot(stored, snapshot)?;
        Ok(to_api_proxy(updated))
    }

    pub fn batch_check_proxies(
        &self,
        req: BatchCheckProxiesRequest,
        geoip_database_path: &Path,
    ) -> AppResult<BatchProxyActionResponse> {
        self.batch_check_proxies_with(req, |proxy_id| {
            self.check_proxy(proxy_id, geoip_database_path)
        })
    }

    fn batch_check_proxies_with<F>(
        &self,
        req: BatchCheckProxiesRequest,
        checker: F,
    ) -> AppResult<BatchProxyActionResponse>
    where
        F: Fn(&str) -> AppResult<Proxy>,
    {
        if req.proxy_ids.is_empty() {
            return Err(AppError::Validation(
                "proxy_ids must not be empty".to_string(),
            ));
        }

        let total = req.proxy_ids.len();
        let mut success_count = 0usize;
        let mut items = Vec::with_capacity(total);
        for proxy_id in req.proxy_ids {
            match checker(&proxy_id) {
                Ok(proxy) => {
                    let ok = proxy.check_status.as_deref() == Some(CHECK_STATUS_OK);
                    if ok {
                        success_count += 1;
                    }
                    items.push(BatchProxyActionItem {
                        proxy_id,
                        ok,
                        message: proxy
                            .check_message
                            .or(proxy.check_status)
                            .unwrap_or_else(|| CHECK_STATUS_UNKNOWN.to_string()),
                    });
                }
                Err(err) => items.push(BatchProxyActionItem {
                    proxy_id,
                    ok: false,
                    message: err.to_string(),
                }),
            }
        }

        Ok(BatchProxyActionResponse {
            total,
            success_count,
            failed_count: total.saturating_sub(success_count),
            items,
        })
    }

    pub fn restore_proxy(&self, proxy_id: &str) -> AppResult<Proxy> {
        let stored = self.find_proxy_model(proxy_id)?;
        if stored.lifecycle == LIFECYCLE_ACTIVE {
            return Err(AppError::Conflict(format!("proxy not deleted: {proxy_id}")));
        }

        let mut active_model: proxy::ActiveModel = stored.into();
        active_model.lifecycle = Set(LIFECYCLE_ACTIVE.to_string());
        active_model.deleted_at = Set(None);
        active_model.updated_at = Set(now_ts());

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(to_api_proxy(updated))
    }

    pub fn purge_proxy(&self, proxy_id: &str) -> AppResult<()> {
        let stored = self.find_proxy_model(proxy_id)?;
        if stored.lifecycle != LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "proxy must be deleted before purge: {proxy_id}"
            )));
        }

        self.db_query(
            profile_proxy_binding::Entity::delete_many()
                .filter(profile_proxy_binding::Column::ProxyId.eq(stored.id))
                .exec(&self.db),
        )?;
        self.db_query(proxy::Entity::delete_by_id(stored.id).exec(&self.db))?;
        Ok(())
    }

    pub fn bind_profile_proxy(
        &self,
        profile_id: &str,
        proxy_id: &str,
    ) -> AppResult<ProfileProxyBinding> {
        let profile_pk = parse_id("profile", "pf_", profile_id)?;
        let proxy_pk = parse_id("proxy", "px_", proxy_id)?;

        let profile_model = self
            .db_query(profile::Entity::find_by_id(profile_pk).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("profile not found: {profile_id}")))?;
        if profile_model.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let proxy_model = self.find_proxy_model_by_pk(proxy_pk)?;
        if proxy_model.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "proxy already deleted: {proxy_id}"
            )));
        }

        let now = now_ts();
        let current = self.db_query(
            profile_proxy_binding::Entity::find()
                .filter(profile_proxy_binding::Column::ProfileId.eq(profile_pk))
                .one(&self.db),
        )?;

        let binding = if let Some(current) = current {
            let mut active_model: profile_proxy_binding::ActiveModel = current.into();
            active_model.proxy_id = Set(proxy_pk);
            active_model.updated_at = Set(now);
            self.db_query(active_model.update(&self.db))?
        } else {
            let insert_result = self.db_query(
                profile_proxy_binding::Entity::insert(profile_proxy_binding::ActiveModel {
                    profile_id: Set(profile_pk),
                    proxy_id: Set(proxy_pk),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                })
                .exec(&self.db),
            )?;
            self.db_query(
                profile_proxy_binding::Entity::find_by_id(insert_result.last_insert_id)
                    .one(&self.db),
            )?
            .ok_or_else(|| AppError::NotFound("binding not found right after insert".to_string()))?
        };

        Ok(to_api_binding(binding))
    }

    pub fn unbind_profile_proxy(&self, profile_id: &str) -> AppResult<ProfileProxyBinding> {
        let profile_pk = parse_id("profile", "pf_", profile_id)?;
        let binding = self
            .db_query(
                profile_proxy_binding::Entity::find()
                    .filter(profile_proxy_binding::Column::ProfileId.eq(profile_pk))
                    .one(&self.db),
            )?
            .ok_or_else(|| {
                AppError::NotFound(format!("binding not found for profile: {profile_id}"))
            })?;

        let result = to_api_binding(binding.clone());
        self.db_query(profile_proxy_binding::Entity::delete_by_id(binding.id).exec(&self.db))?;
        Ok(result)
    }

    pub fn get_profile_proxy(&self, profile_id: &str) -> AppResult<Option<Proxy>> {
        let profile_pk = parse_id("profile", "pf_", profile_id)?;
        let binding = self.db_query(
            profile_proxy_binding::Entity::find()
                .filter(profile_proxy_binding::Column::ProfileId.eq(profile_pk))
                .one(&self.db),
        )?;

        let Some(binding) = binding else {
            return Ok(None);
        };
        let proxy = self.find_proxy_model_by_pk(binding.proxy_id)?;
        if proxy.lifecycle == LIFECYCLE_DELETED {
            return Ok(None);
        }
        Ok(Some(to_api_proxy(proxy)))
    }

    fn perform_proxy_check(
        &self,
        stored: &proxy::Model,
        geoip_database_path: &Path,
    ) -> AppResult<ProxyCheckSnapshot> {
        if stored.protocol == "ssh" {
            return Ok(ProxyCheckSnapshot {
                check_status: CHECK_STATUS_UNSUPPORTED.to_string(),
                check_message: Some("ssh proxy check is not supported yet".to_string()),
                target_site_checks: None,
                exit_ip: None,
                country: None,
                region: None,
                city: None,
                latitude: None,
                longitude: None,
                geo_accuracy_meters: None,
                suggested_language: None,
                suggested_timezone: None,
            });
        }

        let connectivity = check_proxy_connectivity(stored)?;
        let target_site_checks = probe_target_sites_through_proxy(stored);
        let target_site_warning = summarize_target_site_checks(&target_site_checks);
        let exit_ip = match lookup_exit_ip_through_proxy(stored) {
            Ok(value) => Some(value),
            Err(err) => {
                logger::warn(
                    "proxy_service.check",
                    format!(
                        "proxy_id={} exit ip lookup degraded err={}",
                        format_proxy_id(stored.id),
                        err
                    ),
                );
                None
            }
        };

        let Some(exit_ip) = exit_ip else {
            return Ok(ProxyCheckSnapshot {
                check_status: CHECK_STATUS_OK.to_string(),
                check_message: Some(compose_proxy_check_message(
                    connectivity.latency_ms,
                    false,
                    target_site_warning.as_deref(),
                )),
                target_site_checks: Some(target_site_checks),
                exit_ip: None,
                country: None,
                region: None,
                city: None,
                latitude: None,
                longitude: None,
                geo_accuracy_meters: None,
                suggested_language: None,
                suggested_timezone: None,
            });
        };

        let geo = lookup_geoip_city(geoip_database_path, &exit_ip)?;
        let country = geo
            .country
            .as_ref()
            .and_then(|value| value.iso_code.clone())
            .and_then(trim_to_option_ref);
        let region = geo
            .subdivisions
            .as_ref()
            .and_then(|items| items.first())
            .and_then(extract_geo_name);
        let city = geo.city.as_ref().and_then(extract_geo_name);
        let latitude = geo.location.as_ref().and_then(|value| value.latitude);
        let longitude = geo.location.as_ref().and_then(|value| value.longitude);
        let geo_accuracy_meters = geo
            .location
            .as_ref()
            .and_then(|value| value.accuracy_radius.map(f64::from));
        let suggested_timezone = geo
            .location
            .as_ref()
            .and_then(|value| value.time_zone.clone())
            .or_else(|| country.as_deref().and_then(default_timezone_from_country));
        let suggested_language = country.as_deref().and_then(default_language_from_country);

        Ok(ProxyCheckSnapshot {
            check_status: CHECK_STATUS_OK.to_string(),
            check_message: Some(compose_proxy_check_message(
                connectivity.latency_ms,
                true,
                target_site_warning.as_deref(),
            )),
            target_site_checks: Some(target_site_checks),
            exit_ip: Some(exit_ip),
            country,
            region,
            city,
            latitude,
            longitude,
            geo_accuracy_meters,
            suggested_language,
            suggested_timezone,
        })
    }

    fn persist_proxy_check_snapshot(
        &self,
        stored: proxy::Model,
        snapshot: ProxyCheckSnapshot,
    ) -> AppResult<proxy::Model> {
        let now = now_ts();
        let locale_settings = normalize_proxy_locale_settings(
            stored.language_source.clone(),
            stored.custom_language.clone(),
            snapshot.suggested_language.clone(),
            stored.timezone_source.clone(),
            stored.custom_timezone.clone(),
            snapshot.suggested_timezone.clone(),
        )?;
        let mut active_model: proxy::ActiveModel = stored.into();
        active_model.check_status = Set(Some(snapshot.check_status));
        active_model.check_message = Set(snapshot.check_message);
        active_model.target_site_checks_json = Set(serialize_target_site_checks(
            snapshot.target_site_checks.as_deref(),
        )?);
        active_model.last_checked_at = Set(Some(now));
        active_model.exit_ip = Set(snapshot.exit_ip);
        active_model.country = Set(snapshot.country);
        active_model.region = Set(snapshot.region);
        active_model.city = Set(snapshot.city);
        active_model.latitude = Set(snapshot.latitude);
        active_model.longitude = Set(snapshot.longitude);
        active_model.geo_accuracy_meters = Set(snapshot.geo_accuracy_meters);
        active_model.suggested_language = Set(snapshot.suggested_language);
        active_model.suggested_timezone = Set(snapshot.suggested_timezone);
        active_model.language_source = Set(Some(locale_settings.language_source));
        active_model.custom_language = Set(locale_settings.custom_language);
        active_model.effective_language = Set(locale_settings.effective_language);
        active_model.timezone_source = Set(Some(locale_settings.timezone_source));
        active_model.custom_timezone = Set(locale_settings.custom_timezone);
        active_model.effective_timezone = Set(locale_settings.effective_timezone);
        active_model.updated_at = Set(now);
        self.db_query(active_model.update(&self.db))
    }

    fn find_proxy_model(&self, proxy_id: &str) -> AppResult<proxy::Model> {
        let id = parse_id("proxy", "px_", proxy_id)?;
        self.find_proxy_model_by_pk(id)
    }

    fn find_proxy_model_by_pk(&self, id: i64) -> AppResult<proxy::Model> {
        let item = self.db_query(proxy::Entity::find_by_id(id).one(&self.db))?;
        item.ok_or_else(|| AppError::NotFound(format!("proxy not found: {}", format_proxy_id(id))))
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        tauri::async_runtime::block_on(future).map_err(AppError::from)
    }
}

fn to_api_proxy(model: proxy::Model) -> Proxy {
    Proxy {
        id: format_proxy_id(model.id),
        name: model.name,
        protocol: model.protocol,
        host: model.host,
        port: model.port,
        username: model.username,
        password: model.password,
        country: model.country,
        region: model.region,
        city: model.city,
        provider: model.provider,
        note: model.note,
        check_status: model.check_status,
        check_message: model.check_message,
        last_checked_at: model.last_checked_at,
        exit_ip: model.exit_ip,
        latitude: model.latitude,
        longitude: model.longitude,
        geo_accuracy_meters: model.geo_accuracy_meters,
        suggested_language: model.suggested_language,
        suggested_timezone: model.suggested_timezone,
        language_source: model.language_source,
        custom_language: model.custom_language,
        effective_language: model.effective_language,
        timezone_source: model.timezone_source,
        custom_timezone: model.custom_timezone,
        effective_timezone: model.effective_timezone,
        target_site_checks: parse_target_site_checks(
            model.target_site_checks_json,
            format_proxy_id(model.id),
        ),
        expires_at: model.expires_at,
        lifecycle: if model.lifecycle == LIFECYCLE_DELETED {
            ProxyLifecycle::Deleted
        } else {
            ProxyLifecycle::Active
        },
        created_at: model.created_at,
        updated_at: model.updated_at,
        deleted_at: model.deleted_at,
    }
}

fn to_api_binding(model: profile_proxy_binding::Model) -> ProfileProxyBinding {
    ProfileProxyBinding {
        profile_id: format_profile_id(model.profile_id),
        proxy_id: format_proxy_id(model.proxy_id),
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn normalize_proxy_locale_settings(
    language_source: Option<String>,
    custom_language: Option<String>,
    suggested_language: Option<String>,
    timezone_source: Option<String>,
    custom_timezone: Option<String>,
    suggested_timezone: Option<String>,
) -> AppResult<ProxyLocaleSettings> {
    let language_source = normalize_proxy_value_source("languageSource", language_source)?;
    let custom_language =
        normalize_proxy_custom_value("customLanguage", &language_source, custom_language)?;
    let timezone_source = normalize_proxy_value_source("timezoneSource", timezone_source)?;
    let custom_timezone =
        normalize_proxy_custom_value("customTimezone", &timezone_source, custom_timezone)?;

    Ok(ProxyLocaleSettings {
        effective_language: resolve_proxy_effective_value(
            &language_source,
            custom_language.as_deref(),
            suggested_language.as_deref(),
        ),
        language_source,
        custom_language,
        effective_timezone: resolve_proxy_effective_value(
            &timezone_source,
            custom_timezone.as_deref(),
            suggested_timezone.as_deref(),
        ),
        timezone_source,
        custom_timezone,
    })
}

fn normalize_proxy_value_source(field_name: &str, value: Option<String>) -> AppResult<String> {
    let normalized = value
        .and_then(trim_string_value)
        .unwrap_or_else(|| PROXY_VALUE_SOURCE_IP.to_string());
    match normalized.as_str() {
        PROXY_VALUE_SOURCE_IP | PROXY_VALUE_SOURCE_CUSTOM => Ok(normalized),
        _ => Err(AppError::Validation(format!(
            "{field_name} must be ip or custom"
        ))),
    }
}

fn normalize_proxy_custom_value(
    field_name: &str,
    source: &str,
    value: Option<String>,
) -> AppResult<Option<String>> {
    let normalized = value.and_then(trim_string_value);
    if source == PROXY_VALUE_SOURCE_CUSTOM && normalized.is_none() {
        return Err(AppError::Validation(format!(
            "{field_name} is required when source is custom"
        )));
    }
    Ok((source == PROXY_VALUE_SOURCE_CUSTOM)
        .then_some(normalized)
        .flatten())
}

fn resolve_proxy_effective_value(
    source: &str,
    custom_value: Option<&str>,
    suggested_value: Option<&str>,
) -> Option<String> {
    match source {
        PROXY_VALUE_SOURCE_CUSTOM => custom_value.and_then(trim_to_option_ref),
        _ => suggested_value.and_then(trim_to_option_ref),
    }
}

fn require_non_empty(field: &str, value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{field} is required")));
    }
    Ok(trimmed.to_string())
}

fn trim_option(input: Option<String>) -> Option<String> {
    input.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn trim_string_value(input: String) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_protocol(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if SUPPORTED_PROTOCOLS.contains(&normalized.as_str()) {
        return Ok(normalized);
    }
    Err(AppError::Validation(format!(
        "unsupported protocol: {value} (supported: {})",
        SUPPORTED_PROTOCOLS.join(", ")
    )))
}

fn validate_port(port: i32) -> AppResult<i32> {
    if (1..=65535).contains(&port) {
        return Ok(port);
    }
    Err(AppError::Validation(format!(
        "invalid port: {port}, expected 1..65535"
    )))
}

fn parse_id(kind: &str, prefix: &str, raw_id: &str) -> AppResult<i64> {
    raw_id
        .strip_prefix(prefix)
        .unwrap_or(raw_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid {kind} id: {raw_id}")))
}

fn format_profile_id(id: i64) -> String {
    format!("pf_{id:06}")
}

fn format_proxy_id(id: i64) -> String {
    format!("px_{id:06}")
}

fn normalize_page(page: u64) -> u64 {
    if page == 0 {
        DEFAULT_PAGE
    } else {
        page
    }
}

fn normalize_page_size(page_size: u64) -> u64 {
    if page_size == 0 {
        return DEFAULT_PAGE_SIZE;
    }
    page_size.min(MAX_PAGE_SIZE)
}

struct ParsedImportLine {
    host: String,
    port: i32,
    username: Option<String>,
    password: Option<String>,
}

fn parse_import_line(line: &str) -> AppResult<ParsedImportLine> {
    let parts: Vec<&str> = line.split(':').collect();
    match parts.as_slice() {
        [host, port] => Ok(ParsedImportLine {
            host: require_non_empty("host", host)?,
            port: validate_port(
                port.parse::<i32>()
                    .map_err(|_| AppError::Validation(format!("invalid port in line: {line}")))?,
            )?,
            username: None,
            password: None,
        }),
        [host, port, username, password] => Ok(ParsedImportLine {
            host: require_non_empty("host", host)?,
            port: validate_port(
                port.parse::<i32>()
                    .map_err(|_| AppError::Validation(format!("invalid port in line: {line}")))?,
            )?,
            username: trim_string_value((*username).to_string()),
            password: trim_string_value((*password).to_string()),
        }),
        _ => Err(AppError::Validation(format!("invalid proxy line: {line}"))),
    }
}

fn lookup_exit_ip_through_proxy(stored: &proxy::Model) -> AppResult<String> {
    let client = build_proxy_http_client(stored, Duration::from_secs(4))?;

    tauri::async_runtime::block_on(async move {
        let mut last_error: Option<AppError> = None;
        for url in resolve_exit_ip_urls()? {
            match lookup_exit_ip_from_url(&client, &url).await {
                Ok(ip) => return Ok(ip),
                Err(err) => {
                    logger::warn(
                        "proxy_service.check",
                        format!(
                            "exit ip lookup failed proxy_id={} url={} err={}",
                            format_proxy_id(stored.id),
                            url,
                            err
                        ),
                    );
                    last_error = Some(err);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            AppError::Validation("出口 IP 查询失败，请检查代理配置或网络连通性".to_string())
        }))
    })
}

fn build_proxy_http_client(stored: &proxy::Model, timeout: Duration) -> AppResult<Client> {
    let proxy = build_reqwest_proxy(stored)?;
    Ok(Client::builder()
        .timeout(timeout)
        .no_proxy()
        .proxy(proxy)
        .build()?)
}

fn probe_target_sites_through_proxy(stored: &proxy::Model) -> Vec<ProxyTargetSiteCheck> {
    let client = match build_proxy_http_client(
        stored,
        Duration::from_secs(TARGET_SITE_CHECK_TIMEOUT_SECS),
    ) {
        Ok(client) => client,
        Err(err) => {
            let message = err.to_string();
            logger::warn(
                "proxy_service.check",
                format!(
                    "target site probe client build failed proxy_id={} err={}",
                    format_proxy_id(stored.id),
                    message
                ),
            );
            return TARGET_SITE_CHECK_TARGETS
                .iter()
                .map(|(site, _)| ProxyTargetSiteCheck {
                    site: (*site).to_string(),
                    reachable: false,
                    status_code: None,
                    latency_ms: None,
                    error: Some(message.clone()),
                })
                .collect();
        }
    };

    tauri::async_runtime::block_on(async move {
        let mut checks = Vec::with_capacity(TARGET_SITE_CHECK_TARGETS.len());
        for (site, url) in TARGET_SITE_CHECK_TARGETS {
            let started_at = Instant::now();
            match client.get(url).send().await {
                Ok(response) => checks.push(ProxyTargetSiteCheck {
                    site: site.to_string(),
                    reachable: true,
                    status_code: Some(response.status().as_u16()),
                    latency_ms: Some(started_at.elapsed().as_millis() as u64),
                    error: None,
                }),
                Err(err) => {
                    let error_message = normalize_target_site_error(&err);
                    logger::warn(
                        "proxy_service.check",
                        format!(
                            "target site probe failed proxy_id={} site={} err={}",
                            format_proxy_id(stored.id),
                            site,
                            error_message
                        ),
                    );
                    checks.push(ProxyTargetSiteCheck {
                        site: site.to_string(),
                        reachable: false,
                        status_code: None,
                        latency_ms: Some(started_at.elapsed().as_millis() as u64),
                        error: Some(error_message),
                    });
                }
            }
        }
        checks
    })
}

fn normalize_target_site_error(err: &reqwest::Error) -> String {
    if err.is_timeout() {
        return "request timeout".to_string();
    }
    if err.is_connect() {
        return "connect failed".to_string();
    }
    if err.is_request() {
        return "request failed".to_string();
    }
    err.to_string()
}

fn summarize_target_site_checks(checks: &[ProxyTargetSiteCheck]) -> Option<String> {
    if checks.is_empty() {
        return None;
    }

    let reachable_count = checks.iter().filter(|item| item.reachable).count();
    if reachable_count == checks.len() {
        return None;
    }

    let unreachable_sites = checks
        .iter()
        .filter(|item| !item.reachable)
        .map(|item| item.site.as_str())
        .collect::<Vec<_>>()
        .join("、");
    Some(format!(
        "目标站可达性 {reachable_count}/{}（{unreachable_sites} 不可达）",
        checks.len()
    ))
}

fn compose_proxy_check_message(
    latency_ms: u64,
    has_exit_ip: bool,
    target_warning: Option<&str>,
) -> String {
    let mut message = if has_exit_ip {
        format!("代理连通正常（{latency_ms} ms）")
    } else {
        format!("代理连通正常（{latency_ms} ms），出口 IP 查询失败")
    };

    if let Some(warning) = target_warning {
        message.push_str("；");
        message.push_str(warning);
    }
    message
}

fn serialize_target_site_checks(
    value: Option<&[ProxyTargetSiteCheck]>,
) -> AppResult<Option<String>> {
    let Some(items) = value else {
        return Ok(None);
    };

    let raw_checks: Vec<RawTargetSiteCheck> = items
        .iter()
        .map(|item| RawTargetSiteCheck {
            site: item.site.clone(),
            reachable: item.reachable,
            status_code: item.status_code,
            latency_ms: item.latency_ms,
            error: item.error.clone(),
        })
        .collect();
    Ok(Some(serde_json::to_string(&raw_checks)?))
}

fn parse_target_site_checks(
    value: Option<String>,
    proxy_id: String,
) -> Option<Vec<ProxyTargetSiteCheck>> {
    let raw = value?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some(Vec::new());
    }

    let parsed = serde_json::from_str::<Vec<RawTargetSiteCheck>>(trimmed);
    match parsed {
        Ok(items) => Some(
            items
                .into_iter()
                .map(|item| ProxyTargetSiteCheck {
                    site: item.site,
                    reachable: item.reachable,
                    status_code: item.status_code,
                    latency_ms: item.latency_ms,
                    error: item.error,
                })
                .collect(),
        ),
        Err(err) => {
            logger::warn(
                "proxy_service.data",
                format!(
                    "parse target_site_checks_json failed proxy_id={} err={}",
                    proxy_id, err
                ),
            );
            Some(Vec::new())
        }
    }
}

fn check_proxy_connectivity(stored: &proxy::Model) -> AppResult<ProxyConnectivitySnapshot> {
    let address = resolve_proxy_socket_addr(stored)?;
    let started_at = Instant::now();
    TcpStream::connect_timeout(&address, Duration::from_secs(3)).map_err(|err| {
        AppError::Validation(format!(
            "proxy tcp connect failed {}:{}: {}",
            stored.host, stored.port, err
        ))
    })?;
    Ok(ProxyConnectivitySnapshot {
        latency_ms: started_at.elapsed().as_millis() as u64,
    })
}

fn resolve_proxy_socket_addr(stored: &proxy::Model) -> AppResult<SocketAddr> {
    let host_port = format!("{}:{}", stored.host, stored.port);
    host_port
        .to_socket_addrs()
        .map_err(|err| {
            AppError::Validation(format!(
                "resolve proxy host failed {}:{}: {}",
                stored.host, stored.port, err
            ))
        })?
        .next()
        .ok_or_else(|| {
            AppError::Validation(format!(
                "resolve proxy host returned no address {}:{}",
                stored.host, stored.port
            ))
        })
}

fn build_reqwest_proxy(stored: &proxy::Model) -> AppResult<ReqwestProxy> {
    let proxy_url = format!("{}://{}:{}", stored.protocol, stored.host, stored.port);
    let mut proxy = ReqwestProxy::all(&proxy_url)?;
    if let Some(username) = stored.username.as_deref().and_then(trim_to_option_ref) {
        proxy = proxy.basic_auth(&username, stored.password.as_deref().unwrap_or(""));
    }
    Ok(proxy)
}

fn resolve_exit_ip_urls() -> AppResult<Vec<String>> {
    let mut urls = Vec::new();

    if let Ok(custom) = env::var(IPINFO_URL_ENV) {
        if let Some(value) = trim_to_option_ref(custom) {
            urls.push(value);
        }
    }

    if let Ok(token) = env::var(IPINFO_TOKEN_ENV) {
        if let Some(value) = trim_to_option_ref(token) {
            urls.push(format!("{DEFAULT_IPINFO_LITE_URL}?token={value}"));
        }
    }

    urls.push(DEFAULT_IPINFO_JSON_URL.to_string());
    urls.push(DEFAULT_IPIFY_JSON_URL.to_string());
    urls.push(DEFAULT_IPIFY64_JSON_URL.to_string());
    urls.push(DEFAULT_IP_SB_TEXT_URL.to_string());
    urls.push(DEFAULT_IFCONFIG_TEXT_URL.to_string());

    urls.dedup();
    Ok(urls)
}

async fn lookup_exit_ip_from_url(client: &Client, url: &str) -> AppResult<String> {
    let response = client.get(url).send().await?.error_for_status()?;
    let body = response.text().await?;

    if let Ok(parsed) = serde_json::from_str::<IpInfoResponse>(&body) {
        if let Some(ip) = parsed.ip.and_then(trim_to_option_ref) {
            validate_exit_ip(&ip)?;
            return Ok(ip);
        }
    }

    let value = body
        .lines()
        .next()
        .and_then(trim_to_option_ref)
        .ok_or_else(|| AppError::Validation("exit ip response missing ip".to_string()))?;
    validate_exit_ip(&value)?;
    Ok(value)
}

fn validate_exit_ip(value: &str) -> AppResult<()> {
    value
        .parse::<IpAddr>()
        .map(|_| ())
        .map_err(|err| AppError::Validation(format!("invalid exit ip {value}: {err}")))
}

fn humanize_proxy_check_error(err: &AppError) -> String {
    match err {
        AppError::Http(inner) if inner.is_timeout() => {
            "代理检测超时，请检查代理网络连通性".to_string()
        }
        AppError::Http(_) => "出口 IP 查询失败，请检查代理配置或网络连通性".to_string(),
        AppError::Validation(message)
            if message.contains("http error")
                || message.contains("ipinfo")
                || message.contains("exit ip")
                || message.contains("sending request")
                || message.contains("dns")
                || message.contains("connection") =>
        {
            "出口 IP 查询失败，请检查代理配置或网络连通性".to_string()
        }
        _ => err.to_string(),
    }
}

fn lookup_geoip_city(geoip_database_path: &Path, exit_ip: &str) -> AppResult<GeoIpCityRecord> {
    let reader = Reader::open_readfile(geoip_database_path)
        .map_err(|err| AppError::Validation(format!("failed to open geoip database: {err}")))?;
    let address = exit_ip
        .parse::<IpAddr>()
        .map_err(|err| AppError::Validation(format!("invalid exit ip {exit_ip}: {err}")))?;
    let record = reader
        .lookup::<GeoIpCityRecord>(address)
        .map_err(|err| AppError::Validation(format!("geoip lookup failed: {err}")))?;
    record.ok_or_else(|| AppError::Validation(format!("geoip record missing for ip: {exit_ip}")))
}

pub(crate) fn lookup_geoip_geolocation(
    geoip_database_path: &Path,
    exit_ip: &str,
) -> AppResult<GeolocationOverride> {
    let geo = lookup_geoip_city(geoip_database_path, exit_ip)?;
    let location = geo
        .location
        .ok_or_else(|| AppError::Validation(format!("geoip location missing for ip: {exit_ip}")))?;
    let latitude = location
        .latitude
        .ok_or_else(|| AppError::Validation(format!("geoip latitude missing for ip: {exit_ip}")))?;
    let longitude = location.longitude.ok_or_else(|| {
        AppError::Validation(format!("geoip longitude missing for ip: {exit_ip}"))
    })?;

    Ok(GeolocationOverride {
        latitude,
        longitude,
        accuracy: location.accuracy_radius.map(f64::from),
    })
}

fn extract_geo_name(record: &GeoIpNameRecord) -> Option<String> {
    record
        .names
        .as_ref()
        .and_then(|value| value.get("en").cloned())
        .or_else(|| {
            record
                .names
                .as_ref()
                .and_then(|value| value.values().next().cloned())
        })
        .and_then(trim_to_option_ref)
}

fn default_language_from_country(country: &str) -> Option<String> {
    let value = match country.trim().to_uppercase().as_str() {
        "CN" => "zh-CN",
        "TW" => "zh-TW",
        "HK" => "zh-HK",
        "JP" => "ja-JP",
        "KR" => "ko-KR",
        "DE" => "de-DE",
        "FR" => "fr-FR",
        "GB" => "en-GB",
        "US" => "en-US",
        _ => "en-US",
    };
    Some(value.to_string())
}

fn default_timezone_from_country(country: &str) -> Option<String> {
    let value = match country.trim().to_uppercase().as_str() {
        "CN" => "Asia/Shanghai",
        "JP" => "Asia/Tokyo",
        "KR" => "Asia/Seoul",
        "DE" => "Europe/Berlin",
        "FR" => "Europe/Paris",
        "GB" => "Europe/London",
        "US" => "America/New_York",
        _ => return None,
    };
    Some(value.to_string())
}

fn trim_to_option_ref(input: impl AsRef<str>) -> Option<String> {
    let value = input.as_ref().trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{
        BatchCheckProxiesRequest, CreateProfileRequest, CreateProxyRequest, ImportProxiesRequest,
        UpdateProxyRequest,
    };
    use crate::services::profile_service::ProfileService;

    fn build_proxy_check_snapshot() -> ProxyCheckSnapshot {
        ProxyCheckSnapshot {
            check_status: "ok".to_string(),
            check_message: None,
            target_site_checks: Some(vec![
                ProxyTargetSiteCheck {
                    site: TARGET_SITE_GOOGLE.to_string(),
                    reachable: true,
                    status_code: Some(200),
                    latency_ms: Some(120),
                    error: None,
                },
                ProxyTargetSiteCheck {
                    site: TARGET_SITE_YOUTUBE.to_string(),
                    reachable: true,
                    status_code: Some(200),
                    latency_ms: Some(130),
                    error: None,
                },
            ]),
            exit_ip: Some("8.8.8.8".to_string()),
            country: Some("US".to_string()),
            region: Some("California".to_string()),
            city: Some("Mountain View".to_string()),
            latitude: Some(37.386),
            longitude: Some(-122.0838),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
        }
    }

    fn build_proxy_check_snapshot_with_target_warning() -> ProxyCheckSnapshot {
        ProxyCheckSnapshot {
            check_status: "ok".to_string(),
            check_message: Some(
                "代理连通正常（120 ms）；目标站可达性 1/2（google.com 不可达）".to_string(),
            ),
            target_site_checks: Some(vec![
                ProxyTargetSiteCheck {
                    site: TARGET_SITE_GOOGLE.to_string(),
                    reachable: false,
                    status_code: None,
                    latency_ms: Some(3000),
                    error: Some("connect failed".to_string()),
                },
                ProxyTargetSiteCheck {
                    site: TARGET_SITE_YOUTUBE.to_string(),
                    reachable: true,
                    status_code: Some(200),
                    latency_ms: Some(160),
                    error: None,
                },
            ]),
            exit_ip: Some("8.8.8.8".to_string()),
            country: Some("US".to_string()),
            region: Some("California".to_string()),
            city: Some("Mountain View".to_string()),
            latitude: Some(37.386),
            longitude: Some(-122.0838),
            geo_accuracy_meters: Some(20.0),
            suggested_language: Some("en-US".to_string()),
            suggested_timezone: Some("America/Los_Angeles".to_string()),
        }
    }

    #[test]
    fn create_proxy_defaults_to_ip_sources() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-default".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        assert_eq!(proxy.language_source.as_deref(), Some("ip"));
        assert_eq!(proxy.timezone_source.as_deref(), Some("ip"));
        assert_eq!(proxy.effective_language, None);
        assert_eq!(proxy.effective_timezone, None);
    }

    #[test]
    fn check_proxy_keeps_custom_effective_values() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-custom".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: Some("de-DE".to_string()),
                language_source: Some("custom".to_string()),
                custom_timezone: Some("Europe/Berlin".to_string()),
                timezone_source: Some("custom".to_string()),
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| Ok(build_proxy_check_snapshot()))
            .expect("check proxy");

        assert_eq!(checked.suggested_language.as_deref(), Some("en-US"));
        assert_eq!(
            checked.suggested_timezone.as_deref(),
            Some("America/Los_Angeles")
        );
        assert_eq!(checked.effective_language.as_deref(), Some("de-DE"));
        assert_eq!(checked.effective_timezone.as_deref(), Some("Europe/Berlin"));
    }

    #[test]
    fn check_proxy_refreshes_effective_values_for_ip_sources() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-ip".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: Some("ip".to_string()),
                custom_timezone: None,
                timezone_source: Some("ip".to_string()),
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| Ok(build_proxy_check_snapshot()))
            .expect("check proxy");

        assert_eq!(checked.effective_language.as_deref(), Some("en-US"));
        assert_eq!(
            checked.effective_timezone.as_deref(),
            Some("America/Los_Angeles")
        );
    }

    #[test]
    fn proxy_binding_stays_consistent_after_proxy_deleted() {
        let db = db::init_test_database().expect("init test db");
        let profile_service = ProfileService::from_db(db.clone());
        let proxy_service = ProxyService::from_db(db);

        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "worker-1".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let proxy = proxy_service
            .create_proxy(CreateProxyRequest {
                name: "proxy-us".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        proxy_service
            .bind_profile_proxy(&profile.id, &proxy.id)
            .expect("bind profile proxy");
        let bound = proxy_service
            .get_profile_proxy(&profile.id)
            .expect("get profile proxy")
            .expect("bound proxy");
        assert_eq!(bound.id, proxy.id);

        proxy_service
            .soft_delete_proxy(&proxy.id)
            .expect("soft delete proxy");

        let current = proxy_service
            .get_profile_proxy(&profile.id)
            .expect("get proxy after delete");
        assert!(current.is_none());

        let unbind_err = proxy_service
            .unbind_profile_proxy(&profile.id)
            .expect_err("unbind should fail after auto cleanup");
        assert!(matches!(unbind_err, AppError::NotFound(_)));

        let bind_deleted_err = proxy_service
            .bind_profile_proxy(&profile.id, &proxy.id)
            .expect_err("cannot bind deleted proxy");
        assert!(matches!(bind_deleted_err, AppError::Conflict(_)));
    }

    #[test]
    fn list_proxies_supports_pagination_and_filters() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        service
            .create_proxy(CreateProxyRequest {
                name: "proxy-a".to_string(),
                protocol: "http".to_string(),
                host: "10.0.0.1".to_string(),
                port: 8001,
                username: None,
                password: None,
                provider: Some("isp-a".to_string()),
                note: Some("residential".to_string()),
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy a");

        service
            .create_proxy(CreateProxyRequest {
                name: "proxy-b".to_string(),
                protocol: "socks5".to_string(),
                host: "10.0.0.2".to_string(),
                port: 8002,
                username: None,
                password: None,
                provider: Some("isp-b".to_string()),
                note: Some("datacenter".to_string()),
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy b");

        let page1 = service
            .list_proxies(ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 1,
                keyword: None,
                protocol: None,
                country: None,
                check_status: None,
            })
            .expect("list proxy page");
        assert_eq!(page1.total, 2);
        assert_eq!(page1.total_pages, 2);
        assert_eq!(page1.items.len(), 1);

        let protocol_filtered = service
            .list_proxies(ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: None,
                protocol: Some("socks5".to_string()),
                country: None,
                check_status: None,
            })
            .expect("list by protocol");
        assert_eq!(protocol_filtered.total, 1);
        assert_eq!(protocol_filtered.items[0].name, "proxy-b");

        let keyword_filtered = service
            .list_proxies(ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: Some("residential".to_string()),
                protocol: None,
                country: None,
                check_status: None,
            })
            .expect("list by keyword");
        assert_eq!(keyword_filtered.total, 1);
        assert_eq!(keyword_filtered.items[0].name, "proxy-a");
    }

    #[test]
    fn batch_update_proxies_updates_selected_fields_only() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let first = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-a".to_string(),
                protocol: "http".to_string(),
                host: "10.0.0.1".to_string(),
                port: 8001,
                username: Some("user-a".to_string()),
                password: None,
                provider: Some("isp-a".to_string()),
                note: Some("residential".to_string()),
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy a");

        let second = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-b".to_string(),
                protocol: "socks5".to_string(),
                host: "10.0.0.2".to_string(),
                port: 8002,
                username: Some("user-b".to_string()),
                password: None,
                provider: Some("isp-b".to_string()),
                note: Some("datacenter".to_string()),
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy b");

        let result = service
            .batch_update_proxies(
                vec![first.id.clone(), second.id.clone()],
                UpdateProxyRequest {
                    protocol: Some("https".to_string()),
                    provider: Some("batch-provider".to_string()),
                    note: Some("".to_string()),
                    custom_language: None,
                    language_source: None,
                    custom_timezone: None,
                    timezone_source: None,
                    ..Default::default()
                },
            )
            .expect("batch update proxies");

        assert_eq!(result.total, 2);
        assert_eq!(result.success_count, 2);
        let first_updated = service.find_proxy_model(&first.id).expect("find first");
        let second_updated = service.find_proxy_model(&second.id).expect("find second");
        assert_eq!(first_updated.protocol, "https");
        assert_eq!(second_updated.protocol, "https");
        assert_eq!(first_updated.provider.as_deref(), Some("batch-provider"));
        assert_eq!(second_updated.provider.as_deref(), Some("batch-provider"));
        assert!(first_updated.note.is_none());
        assert!(second_updated.note.is_none());
        assert_eq!(first_updated.host, "10.0.0.1");
        assert_eq!(second_updated.port, 8002);
    }

    #[test]
    fn batch_delete_proxies_reports_partial_success() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-delete".to_string(),
                protocol: "http".to_string(),
                host: "10.0.0.1".to_string(),
                port: 8001,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let result = service
            .batch_delete_proxies(vec![proxy.id.clone(), "px_999999".to_string()])
            .expect("batch delete proxies");

        assert_eq!(result.total, 2);
        assert_eq!(result.success_count, 1);
        assert_eq!(result.failed_count, 1);
        let deleted = service.find_proxy_model(&proxy.id).expect("find proxy");
        assert_eq!(deleted.lifecycle, LIFECYCLE_DELETED);
    }

    #[test]
    fn import_proxies_supports_plain_and_auth_lines() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let result = service
            .import_proxies(ImportProxiesRequest {
                protocol: "http".to_string(),
                lines: vec![
                    "127.0.0.1:8080".to_string(),
                    "127.0.0.2:8081:user:pass".to_string(),
                    "bad-line".to_string(),
                ],
            })
            .expect("import proxies");

        assert_eq!(result.total, 3);
        assert_eq!(result.success_count, 2);
        assert_eq!(result.failed_count, 1);

        let list = service
            .list_proxies(ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: None,
                protocol: Some("http".to_string()),
                country: None,
                check_status: None,
            })
            .expect("list imported proxies");
        assert!(list.items.iter().any(|item| item.name == "127.0.0.1:8080"));
    }

    #[test]
    fn check_proxy_updates_last_status() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| Ok(build_proxy_check_snapshot()))
            .expect("check proxy");
        assert_eq!(checked.check_status.as_deref(), Some("ok"));
        assert!(checked.last_checked_at.is_some());

        let batch = service
            .batch_check_proxies_with(
                BatchCheckProxiesRequest {
                    proxy_ids: vec![proxy.id.clone()],
                },
                |proxy_id| service.check_proxy_with(proxy_id, |_| Ok(build_proxy_check_snapshot())),
            )
            .expect("batch check proxies");
        assert_eq!(batch.total, 1);
        assert_eq!(batch.success_count, 1);
    }

    #[test]
    fn batch_check_counts_warning_as_success() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let batch = service
            .batch_check_proxies_with(
                BatchCheckProxiesRequest {
                    proxy_ids: vec![proxy.id.clone()],
                },
                |proxy_id| {
                    service.check_proxy_with(proxy_id, |_| {
                        Ok(build_proxy_check_snapshot_with_target_warning())
                    })
                },
            )
            .expect("batch check proxies");
        assert_eq!(batch.total, 1);
        assert_eq!(batch.success_count, 1);
        assert_eq!(batch.failed_count, 0);
        assert!(batch.items[0].ok);
        assert!(batch.items[0].message.contains("目标站可达性 1/2"));
    }

    #[test]
    fn check_proxy_with_snapshot_persists_proxy_portrait() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: Some("isp-a".to_string()),
                note: None,
                expires_at: Some(1_800_000_000),
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| Ok(build_proxy_check_snapshot()))
            .expect("check proxy");

        assert_eq!(checked.exit_ip.as_deref(), Some("8.8.8.8"));
        assert_eq!(checked.country.as_deref(), Some("US"));
        assert_eq!(checked.region.as_deref(), Some("California"));
        assert_eq!(checked.city.as_deref(), Some("Mountain View"));
        assert_eq!(checked.suggested_language.as_deref(), Some("en-US"));
        assert_eq!(
            checked.suggested_timezone.as_deref(),
            Some("America/Los_Angeles")
        );
        assert_eq!(checked.effective_language.as_deref(), Some("en-US"));
        assert_eq!(
            checked.effective_timezone.as_deref(),
            Some("America/Los_Angeles")
        );
        assert_eq!(checked.check_status.as_deref(), Some("ok"));
        assert_eq!(checked.expires_at, Some(1_800_000_000));
        let target_site_checks = checked
            .target_site_checks
            .as_ref()
            .expect("target site checks");
        assert_eq!(target_site_checks.len(), 2);
        assert!(target_site_checks.iter().all(|item| item.reachable));
    }

    #[test]
    fn check_proxy_masks_exit_ip_lookup_errors() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| {
                Err(AppError::Validation(
                    "http error: error sending request for url (https://ipinfo.io/json)"
                        .to_string(),
                ))
            })
            .expect("check proxy");

        assert_eq!(checked.check_status.as_deref(), Some("error"));
        assert_eq!(
            checked.check_message.as_deref(),
            Some("出口 IP 查询失败，请检查代理配置或网络连通性")
        );
        assert!(checked.target_site_checks.is_none());
    }

    #[test]
    fn check_proxy_marks_ssh_as_unsupported() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "ssh".to_string(),
                host: "127.0.0.1".to_string(),
                port: 22,
                username: Some("root".to_string()),
                password: Some("secret".to_string()),
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |stored| {
                service.perform_proxy_check(stored, Path::new("/tmp/unused.mmdb"))
            })
            .expect("check proxy");
        assert_eq!(checked.check_status.as_deref(), Some("unsupported"));
        assert!(checked
            .check_message
            .as_deref()
            .is_some_and(|value| value.contains("ssh")));
        assert!(checked.target_site_checks.is_none());
    }

    #[test]
    fn check_proxy_error_clears_target_site_checks_json() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let stored = service.find_proxy_model(&proxy.id).expect("find proxy");
        let mut active_model: proxy::ActiveModel = stored.into();
        active_model.target_site_checks_json = Set(Some("[{\"site\":\"google.com\"}]".to_string()));
        service
            .db_query(active_model.update(&service.db))
            .expect("seed target site checks");

        let checked = service
            .check_proxy_with(proxy.id.as_str(), |_| {
                Err(AppError::Validation("mock error".to_string()))
            })
            .expect("check proxy");
        assert!(checked.target_site_checks.is_none());

        let updated = service.find_proxy_model(&proxy.id).expect("find updated");
        assert!(updated.target_site_checks_json.is_none());
    }

    #[test]
    fn list_proxies_tolerates_invalid_target_site_checks_json() {
        let db = db::init_test_database().expect("init test db");
        let service = ProxyService::from_db(db);

        let proxy = service
            .create_proxy(CreateProxyRequest {
                name: "proxy-check".to_string(),
                protocol: "http".to_string(),
                host: "127.0.0.1".to_string(),
                port: 8080,
                username: None,
                password: None,
                provider: None,
                note: None,
                expires_at: None,
                custom_language: None,
                language_source: None,
                custom_timezone: None,
                timezone_source: None,
            })
            .expect("create proxy");

        let stored = service.find_proxy_model(&proxy.id).expect("find proxy");
        let mut active_model: proxy::ActiveModel = stored.into();
        active_model.target_site_checks_json = Set(Some("{bad json}".to_string()));
        service
            .db_query(active_model.update(&service.db))
            .expect("write invalid json");

        let listed = service
            .list_proxies(ListProxiesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: None,
                protocol: None,
                country: None,
                check_status: None,
            })
            .expect("list proxies");
        assert_eq!(listed.total, 1);
        assert_eq!(
            listed.items[0].target_site_checks.as_ref().map(|v| v.len()),
            Some(0)
        );
    }
}
