use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set,
};

use crate::db::entities::{profile, profile_proxy_binding, proxy};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, CreateProxyRequest, ListProxiesQuery, ListProxiesResponse, ProfileProxyBinding, Proxy,
    ProxyLifecycle,
};

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";
const SUPPORTED_PROTOCOLS: &[&str] = &["http", "https", "socks5", "ssh"];
const DEFAULT_PAGE: u64 = 1;
const DEFAULT_PAGE_SIZE: u64 = 50;
const MAX_PAGE_SIZE: u64 = 200;

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
        let now = now_ts();

        let model = proxy::ActiveModel {
            name: Set(name),
            protocol: Set(protocol),
            host: Set(host),
            port: Set(port),
            username: Set(trim_option(req.username)),
            password: Set(trim_option(req.password)),
            country: Set(trim_option(req.country)),
            region: Set(trim_option(req.region)),
            city: Set(trim_option(req.city)),
            provider: Set(trim_option(req.provider)),
            note: Set(trim_option(req.note)),
            last_status: Set(None),
            last_checked_at: Set(None),
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

        if let Some(last_status) = trim_option(params.last_status) {
            query = query.filter(proxy::Column::LastStatus.eq(last_status));
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
        last_status: model.last_status,
        last_checked_at: model.last_checked_at,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{CreateProfileRequest, CreateProxyRequest};
    use crate::services::profile_service::ProfileService;

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
                country: Some("US".to_string()),
                region: Some("NY".to_string()),
                city: Some("New York".to_string()),
                provider: None,
                note: None,
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
                country: Some("US".to_string()),
                region: None,
                city: None,
                provider: Some("isp-a".to_string()),
                note: Some("residential".to_string()),
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
                country: Some("DE".to_string()),
                region: None,
                city: None,
                provider: Some("isp-b".to_string()),
                note: Some("datacenter".to_string()),
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
                last_status: None,
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
                last_status: None,
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
                last_status: None,
            })
            .expect("list by keyword");
        assert_eq!(keyword_filtered.total, 1);
        assert_eq!(keyword_filtered.items[0].name, "proxy-a");
    }
}
