use std::future::Future;
use std::net::IpAddr;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set,
};

use crate::db::entities::{profile, profile_group, profile_proxy_binding};
use crate::error::{AppError, AppResult};
use crate::fingerprint_catalog;
use crate::font_catalog;
use crate::models::{
    now_ts, BrowserBgColorMode, CookieStateFile, CreateProfileRequest, FingerprintSeedPolicy,
    FontListMode, GeolocationMode, ListProfilesQuery, ListProfilesResponse, Profile,
    ProfileFingerprintSettings, ProfileFingerprintSnapshot, ProfileFingerprintSource,
    ProfileLifecycle, ProfileSettings, ToolbarLabelMode, UserAgentMode,
};
use crate::services::device_preset_service::DevicePresetService;

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";
const DEFAULT_PAGE: u64 = 1;
const DEFAULT_PAGE_SIZE: u64 = 50;
const MAX_PAGE_SIZE: u64 = 200;

pub struct ProfileService {
    db: DatabaseConnection,
}

impl ProfileService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_profile(&self, req: CreateProfileRequest) -> AppResult<Profile> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".to_string()));
        }
        let group_name = self.ensure_active_group_name(req.group)?;
        let settings = normalize_profile_settings(&self.db, req.settings, None)?;
        let settings_json = settings
            .as_ref()
            .map(|value| serde_json::to_string(value))
            .transpose()?;

        let now = now_ts();
        let profile_model = profile::ActiveModel {
            name: Set(name.to_string()),
            group_name: Set(group_name),
            note: Set(req.note.and_then(trim_to_option)),
            settings_json: Set(settings_json),
            lifecycle: Set(LIFECYCLE_ACTIVE.to_string()),
            running: Set(false),
            created_at: Set(now),
            updated_at: Set(now),
            deleted_at: Set(None),
            last_opened_at: Set(None),
            ..Default::default()
        };

        let insert_result = self.db_query(profile::Entity::insert(profile_model).exec(&self.db))?;
        let created = self.find_profile_model_by_pk(insert_result.last_insert_id)?;
        Ok(self.to_api_profile(created))
    }

    pub fn update_profile(
        &self,
        profile_id: &str,
        req: CreateProfileRequest,
    ) -> AppResult<Profile> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".to_string()));
        }
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let group_name = self.ensure_active_group_name(req.group)?;
        let previous_settings = parse_settings_json(stored.settings_json.clone());
        let settings =
            normalize_profile_settings(&self.db, req.settings, previous_settings.as_ref())?;
        let settings_json = settings
            .as_ref()
            .map(|value| serde_json::to_string(value))
            .transpose()?;
        let mut active_model: profile::ActiveModel = stored.into();
        active_model.name = Set(name.to_string());
        active_model.group_name = Set(group_name);
        active_model.note = Set(req.note.and_then(trim_to_option));
        active_model.settings_json = Set(settings_json);
        active_model.updated_at = Set(now_ts());

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn update_profile_visual(
        &self,
        profile_id: &str,
        browser_bg_color_mode: Option<BrowserBgColorMode>,
        browser_bg_color: Option<String>,
        toolbar_label_mode: Option<ToolbarLabelMode>,
    ) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        let mut settings = parse_settings_json(stored.settings_json.clone()).unwrap_or_default();
        let basic = settings.basic.get_or_insert_with(Default::default);
        let normalized_color = browser_bg_color
            .and_then(trim_to_option)
            .map(normalize_hex_color)
            .transpose()?;
        if matches!(browser_bg_color_mode, Some(BrowserBgColorMode::Custom))
            && normalized_color.is_none()
        {
            return Err(AppError::Validation(
                "browserBgColor is required when browserBgColorMode=custom".to_string(),
            ));
        }
        basic.browser_bg_color_mode = browser_bg_color_mode;
        basic.browser_bg_color = match basic.browser_bg_color_mode {
            Some(BrowserBgColorMode::None) | Some(BrowserBgColorMode::Inherit) => None,
            Some(BrowserBgColorMode::Custom) => normalized_color,
            None => normalized_color,
        };
        basic.toolbar_label_mode = toolbar_label_mode;
        basic.toolbar_text = None;

        let normalized = normalize_profile_settings(&self.db, Some(settings), None)?;
        let settings_json = normalized
            .as_ref()
            .map(|value| serde_json::to_string(value))
            .transpose()?;

        let mut active_model: profile::ActiveModel = stored.into();
        active_model.settings_json = Set(settings_json);
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn set_profile_group(
        &self,
        profile_id: &str,
        group_name: Option<String>,
    ) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let mut active_model: profile::ActiveModel = stored.into();
        active_model.group_name = Set(self.ensure_active_group_name(group_name)?);
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn set_fixed_fingerprint_seed(&self, profile_id: &str, seed: u32) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let mut settings = parse_settings_json(stored.settings_json.clone()).unwrap_or_default();
        let advanced = settings.advanced.get_or_insert_with(Default::default);
        advanced.fixed_fingerprint_seed = Some(seed);

        let normalized = normalize_profile_settings(&self.db, Some(settings), None)?;
        let settings_json = normalized
            .as_ref()
            .map(|value| serde_json::to_string(value))
            .transpose()?;

        let mut active_model: profile::ActiveModel = stored.into();
        active_model.settings_json = Set(settings_json);
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn get_profile(&self, profile_id: &str) -> AppResult<Profile> {
        let model = self.find_profile_model(profile_id)?;
        Ok(self.to_api_profile(model))
    }

    pub fn list_profiles(&self, params: ListProfilesQuery) -> AppResult<ListProfilesResponse> {
        let page = normalize_page(params.page);
        let page_size = normalize_page_size(params.page_size);
        let mut query = profile::Entity::find();
        if !params.include_deleted {
            query = query.filter(profile::Column::Lifecycle.eq(LIFECYCLE_ACTIVE));
        }

        if let Some(keyword) = trim_to_option(params.keyword.unwrap_or_default()) {
            let condition = Condition::any()
                .add(profile::Column::Name.contains(&keyword))
                .add(profile::Column::GroupName.contains(&keyword))
                .add(profile::Column::Note.contains(&keyword));
            query = query.filter(condition);
        }

        if let Some(group_name) = trim_to_option(params.group.unwrap_or_default()) {
            query = query.filter(profile::Column::GroupName.eq(group_name));
        }

        if let Some(running) = params.running {
            query = query.filter(profile::Column::Running.eq(running));
        }

        let paginator = query
            .order_by_asc(profile::Column::CreatedAt)
            .paginate(&self.db, page_size);
        let pages = self.db_query(paginator.num_items_and_pages())?;
        let items = self.db_query(paginator.fetch_page(page.saturating_sub(1)))?;
        let items: Vec<Profile> = items
            .into_iter()
            .map(|item| self.to_api_profile(item))
            .collect();

        Ok(ListProfilesResponse {
            total: pages.number_of_items as usize,
            items,
            page,
            page_size,
            total_pages: pages.number_of_pages,
        })
    }

    pub fn mark_profile_running(&self, profile_id: &str, running: bool) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let now = now_ts();
        let mut active_model: profile::ActiveModel = stored.into();
        active_model.running = Set(running);
        active_model.updated_at = Set(now);
        if running {
            active_model.last_opened_at = Set(Some(now));
        }

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn soft_delete_profile(&self, profile_id: &str) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }

        let now = now_ts();
        let mut active_model: profile::ActiveModel = stored.into();
        active_model.lifecycle = Set(LIFECYCLE_DELETED.to_string());
        active_model.running = Set(false);
        active_model.deleted_at = Set(Some(now));
        active_model.updated_at = Set(now);

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn restore_profile(&self, profile_id: &str) -> AppResult<Profile> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle == LIFECYCLE_ACTIVE {
            return Err(AppError::Conflict(format!(
                "profile not deleted: {profile_id}"
            )));
        }

        let mut active_model: profile::ActiveModel = stored.into();
        active_model.lifecycle = Set(LIFECYCLE_ACTIVE.to_string());
        active_model.running = Set(false);
        active_model.deleted_at = Set(None);
        active_model.updated_at = Set(now_ts());

        let updated = self.db_query(active_model.update(&self.db))?;
        Ok(self.to_api_profile(updated))
    }

    pub fn purge_profile(&self, profile_id: &str) -> AppResult<()> {
        let stored = self.find_profile_model(profile_id)?;
        if stored.lifecycle != LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile must be deleted before purge: {profile_id}"
            )));
        }

        self.db_query(
            profile_proxy_binding::Entity::delete_many()
                .filter(profile_proxy_binding::Column::ProfileId.eq(stored.id))
                .exec(&self.db),
        )?;
        self.db_query(profile::Entity::delete_by_id(stored.id).exec(&self.db))?;
        Ok(())
    }

    pub fn reset_running_profiles(&self) -> AppResult<usize> {
        let running_profiles = self.db_query(
            profile::Entity::find()
                .filter(profile::Column::Running.eq(true))
                .all(&self.db),
        )?;
        if running_profiles.is_empty() {
            return Ok(0);
        }

        let now = now_ts();
        let mut affected = 0usize;
        for model in running_profiles {
            let mut active_model: profile::ActiveModel = model.into();
            active_model.running = Set(false);
            active_model.updated_at = Set(now);
            self.db_query(active_model.update(&self.db))?;
            affected += 1;
        }

        Ok(affected)
    }

    fn ensure_active_group_name(&self, group_name: Option<String>) -> AppResult<Option<String>> {
        let Some(group_name) = group_name.and_then(trim_to_option) else {
            return Ok(None);
        };

        let exists = self.db_query(
            profile_group::Entity::find()
                .filter(profile_group::Column::Name.eq(group_name.clone()))
                .filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .one(&self.db),
        )?;
        if exists.is_none() {
            return Err(AppError::NotFound(format!(
                "active group not found: {group_name}"
            )));
        }

        Ok(Some(group_name))
    }

    pub fn list_running_profile_ids(&self) -> AppResult<Vec<String>> {
        let models = self.db_query(
            profile::Entity::find()
                .filter(profile::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .filter(profile::Column::Running.eq(true))
                .all(&self.db),
        )?;
        Ok(models
            .into_iter()
            .map(|item| format_profile_id(item.id))
            .collect())
    }

    pub fn ensure_profile_openable(&self, profile_id: &str) -> AppResult<()> {
        let profile = self.find_profile_model(profile_id)?;
        if profile.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        if profile.running {
            return Err(AppError::Conflict(format!(
                "profile already running: {profile_id}"
            )));
        }
        Ok(())
    }

    pub fn ensure_profile_closable(&self, profile_id: &str) -> AppResult<()> {
        let profile = self.find_profile_model(profile_id)?;
        if profile.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        if !profile.running {
            return Err(AppError::Conflict(format!(
                "profile not running: {profile_id}"
            )));
        }
        Ok(())
    }

    fn find_profile_model(&self, profile_id: &str) -> AppResult<profile::Model> {
        let id = parse_profile_id(profile_id)?;
        self.find_profile_model_by_pk(id)
    }

    fn find_profile_model_by_pk(&self, id: i64) -> AppResult<profile::Model> {
        let profile = self.db_query(profile::Entity::find_by_id(id).one(&self.db))?;
        profile.ok_or_else(|| {
            AppError::NotFound(format!("profile not found: {}", format_profile_id(id)))
        })
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }

    fn to_api_profile(&self, model: profile::Model) -> Profile {
        let settings = parse_settings_json(model.settings_json.clone());
        let resolved_settings = hydrate_settings_for_response(&self.db, settings);
        let visual_defaults = resolve_group_visual_defaults(&self.db, model.group_name.as_deref());
        let resolved_visuals = resolve_profile_visuals(
            model.id,
            model.group_name.as_deref(),
            resolved_settings.as_ref(),
            visual_defaults.as_ref(),
        );
        Profile {
            id: format_profile_id(model.id),
            numeric_id: model.id,
            name: model.name,
            group: model.group_name,
            note: model.note,
            settings: resolved_settings,
            resolved_toolbar_text: resolved_visuals.toolbar_text,
            resolved_browser_bg_color: resolved_visuals.browser_bg_color,
            lifecycle: if model.lifecycle == LIFECYCLE_DELETED {
                ProfileLifecycle::Deleted
            } else {
                ProfileLifecycle::Active
            },
            running: model.running,
            created_at: model.created_at,
            updated_at: model.updated_at,
            deleted_at: model.deleted_at,
            last_opened_at: model.last_opened_at,
        }
    }
}

fn parse_settings_json(settings_json: Option<String>) -> Option<ProfileSettings> {
    let raw = settings_json?;
    serde_json::from_str::<ProfileSettings>(&raw).ok()
}

fn hydrate_settings_for_response(
    db: &DatabaseConnection,
    settings: Option<ProfileSettings>,
) -> Option<ProfileSettings> {
    let previous = settings.clone();
    normalize_profile_settings(db, settings, previous.as_ref())
        .ok()
        .flatten()
        .or(previous)
}

#[derive(Clone)]
struct GroupVisualDefaults {
    browser_bg_color: Option<String>,
    toolbar_label_mode: ToolbarLabelMode,
}

struct ResolvedProfileVisuals {
    toolbar_text: Option<String>,
    browser_bg_color: Option<String>,
}

fn resolve_group_visual_defaults(
    db: &DatabaseConnection,
    group_name: Option<&str>,
) -> Option<GroupVisualDefaults> {
    let group_name = group_name?.trim();
    if group_name.is_empty() {
        return None;
    }
    let row = crate::runtime_compat::block_on_compat(
        profile_group::Entity::find()
            .filter(profile_group::Column::Name.eq(group_name))
            .filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
            .one(db),
    )
    .ok()
    .flatten()?;
    Some(GroupVisualDefaults {
        browser_bg_color: row.browser_bg_color.and_then(trim_to_option),
        toolbar_label_mode: parse_toolbar_label_mode(row.toolbar_label_mode.as_str()),
    })
}

fn resolve_profile_visuals(
    numeric_id: i64,
    group_name: Option<&str>,
    settings: Option<&ProfileSettings>,
    group_defaults: Option<&GroupVisualDefaults>,
) -> ResolvedProfileVisuals {
    let basic = settings.and_then(|value| value.basic.as_ref());
    let legacy_toolbar_text = basic
        .and_then(|value| value.toolbar_text.as_deref())
        .and_then(trim_str_to_option);
    let toolbar_label_mode = basic
        .and_then(|value| value.toolbar_label_mode)
        .or_else(|| group_defaults.map(|value| value.toolbar_label_mode))
        .unwrap_or(ToolbarLabelMode::IdOnly);
    let resolved_toolbar_text = legacy_toolbar_text.or_else(|| {
        Some(match toolbar_label_mode {
            ToolbarLabelMode::IdOnly => numeric_id.to_string(),
            ToolbarLabelMode::GroupNameAndId => {
                let prefix = group_name.and_then(trim_str_to_option);
                match prefix {
                    Some(prefix) => format!("{prefix}-{numeric_id}"),
                    None => numeric_id.to_string(),
                }
            }
        })
    });

    let browser_bg_color = match resolve_effective_browser_bg_color_mode(basic) {
        BrowserBgColorMode::Custom => basic.and_then(|value| value.browser_bg_color.clone()),
        BrowserBgColorMode::Inherit => group_defaults.and_then(|value| value.browser_bg_color.clone()),
        BrowserBgColorMode::None => None,
    };

    ResolvedProfileVisuals {
        toolbar_text: resolved_toolbar_text,
        browser_bg_color,
    }
}

fn normalize_profile_settings(
    db: &DatabaseConnection,
    settings: Option<ProfileSettings>,
    previous: Option<&ProfileSettings>,
) -> AppResult<Option<ProfileSettings>> {
    let Some(mut value) = settings else {
        return Ok(None);
    };

    if let Some(basic) = value.basic.as_mut() {
        basic.browser_kind = basic.browser_kind.take().and_then(trim_to_option);
        basic.browser_version = basic.browser_version.take().and_then(trim_to_option);
        basic.platform = basic.platform.take().and_then(trim_to_option);
        basic.device_preset_id = basic.device_preset_id.take().and_then(trim_to_option);
        basic.startup_urls = normalize_startup_urls(
            basic.startup_urls.take(),
            basic.startup_url.take().and_then(trim_to_option),
        )?;
        basic.startup_url = None;
        basic.browser_bg_color = basic
            .browser_bg_color
            .take()
            .and_then(trim_to_option)
            .map(normalize_hex_color)
            .transpose()?;
        basic.browser_bg_color_mode =
            normalize_browser_bg_color_mode(basic.browser_bg_color_mode, basic.browser_bg_color.is_some());
        basic.toolbar_label_mode = normalize_toolbar_label_mode(basic.toolbar_label_mode);
        basic.toolbar_text = basic.toolbar_text.take().and_then(trim_to_option);
        if matches!(basic.browser_bg_color_mode, Some(BrowserBgColorMode::Inherit | BrowserBgColorMode::None)) {
            basic.browser_bg_color = None;
        }
        if basic.platform.is_none() {
            return Err(AppError::Validation("platform is required".to_string()));
        }
        if basic.browser_kind.is_none()
            && basic.browser_version.is_none()
            && basic.platform.is_none()
            && basic.device_preset_id.is_none()
            && basic.startup_urls.is_none()
            && basic.browser_bg_color.is_none()
            && basic.toolbar_text.is_none()
        {
            value.basic = None;
        }
    }

    if let Some(fingerprint) = value.fingerprint.as_mut() {
        let previous_fingerprint = previous.and_then(|value| value.fingerprint.as_ref());
        let has_strong_fingerprint_context =
            has_strong_fingerprint_settings(Some(fingerprint), previous_fingerprint);
        fingerprint.user_agent = fingerprint.user_agent.take().and_then(trim_to_option);
        fingerprint.language = fingerprint.language.take().and_then(trim_to_option);
        fingerprint.timezone_id = fingerprint.timezone_id.take().and_then(trim_to_option);
        fingerprint.font_list_mode = fingerprint.font_list_mode.take();
        normalize_fingerprint_source(fingerprint.fingerprint_source.as_mut());
        normalize_fingerprint_snapshot(fingerprint.fingerprint_snapshot.as_mut());
        fingerprint.webrtc_ip_override = fingerprint
            .webrtc_ip_override
            .take()
            .and_then(trim_to_option);
        if let Some(value) = fingerprint.viewport_width {
            if value == 0 {
                return Err(AppError::Validation(
                    "viewportWidth must be greater than 0".to_string(),
                ));
            }
        }
        if let Some(value) = fingerprint.viewport_height {
            if value == 0 {
                return Err(AppError::Validation(
                    "viewportHeight must be greater than 0".to_string(),
                ));
            }
        }
        if let Some(value) = fingerprint.device_scale_factor {
            if value <= 0.0 {
                return Err(AppError::Validation(
                    "deviceScaleFactor must be greater than 0".to_string(),
                ));
            }
        }
        if !has_strong_fingerprint_context {
            if let Some(value) = fingerprint.custom_cpu_cores {
                if value == 0 {
                    return Err(AppError::Validation(
                        "customCpuCores must be greater than 0".to_string(),
                    ));
                }
            }
            if let Some(value) = fingerprint.custom_ram_gb {
                if value == 0 {
                    return Err(AppError::Validation(
                        "customRamGb must be greater than 0".to_string(),
                    ));
                }
            }
        }
        fingerprint.custom_font_list = fingerprint.custom_font_list.take().and_then(|items| {
            let normalized = items
                .into_iter()
                .filter_map(trim_to_option)
                .collect::<Vec<_>>();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });
        fingerprint.custom_device_name = fingerprint
            .custom_device_name
            .take()
            .and_then(trim_to_option);
        fingerprint.custom_mac_address = fingerprint
            .custom_mac_address
            .take()
            .and_then(|value| trim_to_option(value).map(|item| item.to_uppercase()));
        if matches!(
            fingerprint.device_name_mode,
            Some(crate::models::CustomValueMode::Custom)
        ) {
            let Some(device_name) = fingerprint.custom_device_name.as_deref() else {
                return Err(AppError::Validation(
                    "custom deviceName mode requires customDeviceName".to_string(),
                ));
            };
            if !is_valid_custom_device_name(device_name) {
                return Err(AppError::Validation(
                    "customDeviceName must use ASCII letters, numbers, or hyphen with length 1-63"
                        .to_string(),
                ));
            }
        } else {
            fingerprint.custom_device_name = None;
        }
        if matches!(
            fingerprint.mac_address_mode,
            Some(crate::models::CustomValueMode::Custom)
        ) {
            let Some(mac_address) = fingerprint.custom_mac_address.as_deref() else {
                return Err(AppError::Validation(
                    "custom macAddress mode requires customMacAddress".to_string(),
                ));
            };
            if !is_valid_custom_mac_address(mac_address) {
                return Err(AppError::Validation(
                    "customMacAddress must be a valid EUI-48 address".to_string(),
                ));
            }
        } else {
            fingerprint.custom_mac_address = None;
        }
        if !has_strong_fingerprint_context {
            if let Some(mode) = fingerprint.user_agent_mode.as_ref() {
                if matches!(mode, crate::models::UserAgentMode::Custom)
                    && fingerprint.user_agent.is_none()
                {
                    return Err(AppError::Validation(
                        "custom userAgent mode requires userAgent value".to_string(),
                    ));
                }
            }
        }
        if matches!(
            fingerprint.web_rtc_mode,
            Some(crate::models::WebRtcMode::Replace)
        ) {
            let Some(ip_value) = fingerprint.webrtc_ip_override.as_deref() else {
                return Err(AppError::Validation(
                    "replace webRtc mode requires webrtcIpOverride".to_string(),
                ));
            };
            if ip_value.parse::<IpAddr>().is_err() {
                return Err(AppError::Validation(
                    "webrtcIpOverride must be a valid IPv4 or IPv6 address".to_string(),
                ));
            }
        } else {
            fingerprint.webrtc_ip_override = None;
        }
        if fingerprint.user_agent_mode.is_none()
            && fingerprint.fingerprint_source.is_none()
            && fingerprint.fingerprint_snapshot.is_none()
            && fingerprint.user_agent.is_none()
            && fingerprint.language.is_none()
            && fingerprint.timezone_id.is_none()
            && fingerprint.font_list_mode.is_none()
            && fingerprint.device_name_mode.is_none()
            && fingerprint.custom_device_name.is_none()
            && fingerprint.mac_address_mode.is_none()
            && fingerprint.custom_mac_address.is_none()
            && fingerprint.do_not_track_enabled.is_none()
            && fingerprint.web_rtc_mode.is_none()
            && fingerprint.webrtc_ip_override.is_none()
            && fingerprint.viewport_width.is_none()
            && fingerprint.viewport_height.is_none()
            && fingerprint.device_scale_factor.is_none()
            && fingerprint.custom_cpu_cores.is_none()
            && fingerprint.custom_ram_gb.is_none()
            && fingerprint.custom_font_list.is_none()
        {
            value.fingerprint = None;
        }
    }

    if let Some(advanced) = value.advanced.as_mut() {
        let geolocation_mode = advanced.geolocation_mode.clone().or_else(|| {
            advanced
                .geolocation
                .as_ref()
                .map(|_| GeolocationMode::Custom)
        });
        if geolocation_mode == Some(GeolocationMode::Custom) {
            let Some(geo) = advanced.geolocation.as_ref() else {
                return Err(AppError::Validation(
                    "custom geolocation mode requires coordinates".to_string(),
                ));
            };
            if !(-90.0..=90.0).contains(&geo.latitude) {
                return Err(AppError::Validation(
                    "invalid geolocation latitude".to_string(),
                ));
            }
            if !(-180.0..=180.0).contains(&geo.longitude) {
                return Err(AppError::Validation(
                    "invalid geolocation longitude".to_string(),
                ));
            }
            if let Some(accuracy) = geo.accuracy {
                if accuracy <= 0.0 {
                    return Err(AppError::Validation(
                        "invalid geolocation accuracy".to_string(),
                    ));
                }
            }
        }
        advanced.custom_launch_args = advanced.custom_launch_args.take().and_then(|items| {
            let normalized = items
                .into_iter()
                .filter_map(trim_to_option)
                .collect::<Vec<_>>();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });
        advanced.cookie_state_json = advanced.cookie_state_json.take().and_then(trim_to_option);
        if let Some(cookie_state_json) = advanced.cookie_state_json.as_deref() {
            let cookie_state = parse_cookie_state_json(cookie_state_json)
                .map_err(|err| AppError::Validation(format!("cookieStateJson {err}")))?;
            advanced.cookie_state_json =
                Some(serde_json::to_string_pretty(&cookie_state).map_err(|err| {
                    AppError::Validation(format!("cookieStateJson serialize failed: {err}"))
                })?);
        }
        advanced.plugin_selections = advanced.plugin_selections.take().and_then(|items| {
            let normalized = items
                .into_iter()
                .filter_map(|item| {
                    let package_id = item.package_id.trim();
                    if package_id.is_empty() {
                        return None;
                    }
                    Some(crate::models::ProfilePluginSelection {
                        package_id: package_id.to_string(),
                        enabled: item.enabled,
                    })
                })
                .collect::<Vec<_>>();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        });
        if advanced.headless.is_none()
            && advanced.disable_images.is_none()
            && advanced.cookie_state_json.is_none()
            && advanced.plugin_selections.is_none()
            && advanced.geolocation_mode.is_none()
            && advanced.auto_allow_geolocation.is_none()
            && advanced.geolocation.is_none()
            && advanced.custom_launch_args.is_none()
            && advanced.random_fingerprint.is_none()
            && advanced.fixed_fingerprint_seed.is_none()
        {
            value.advanced = None;
        }
    }

    hydrate_strong_fingerprint_settings(db, &mut value, previous)?;

    if value.basic.is_none() && value.fingerprint.is_none() && value.advanced.is_none() {
        return Ok(None);
    }

    Ok(Some(value))
}

fn hydrate_strong_fingerprint_settings(
    db: &DatabaseConnection,
    settings: &mut ProfileSettings,
    previous: Option<&ProfileSettings>,
) -> AppResult<()> {
    let Some(basic) = settings.basic.as_mut() else {
        return Ok(());
    };
    let platform = basic
        .platform
        .clone()
        .ok_or_else(|| AppError::Validation("platform is required".to_string()))?;

    let random_fingerprint = settings
        .advanced
        .as_ref()
        .and_then(|value| value.random_fingerprint)
        .unwrap_or(false);
    let previous_fingerprint = previous.and_then(|value| value.fingerprint.as_ref());
    let has_current_strong_fingerprint =
        has_strong_fingerprint_settings(settings.fingerprint.as_ref(), previous_fingerprint);
    let fingerprint = settings.fingerprint.get_or_insert_with(Default::default);
    let previous_snapshot =
        previous_fingerprint.and_then(|value| value.fingerprint_snapshot.as_ref());
    let previous_source = previous_fingerprint.and_then(|value| value.fingerprint_source.as_ref());
    let font_list_mode = fingerprint
        .font_list_mode
        .or_else(|| previous_fingerprint.and_then(|value| value.font_list_mode))
        .unwrap_or(FontListMode::Preset);

    let device_preset_service = DevicePresetService::from_db(db.clone());
    let resolved_source = fingerprint_catalog::normalize_source(
        fingerprint.fingerprint_source.as_ref().or(previous_source),
        Some(platform.as_str()),
        basic.browser_version.as_deref().or_else(|| {
            previous
                .and_then(|value| value.basic.as_ref())
                .and_then(|value| value.browser_version.as_deref())
        }),
        basic.device_preset_id.as_deref().or_else(|| {
            previous
                .and_then(|value| value.basic.as_ref())
                .and_then(|value| value.device_preset_id.as_deref())
        }),
        random_fingerprint,
    );

    basic.browser_version = resolved_source.browser_version.clone();
    basic.device_preset_id = resolved_source.device_preset_id.clone();

    let advanced = settings.advanced.get_or_insert_with(Default::default);
    let persisted_fixed_seed = advanced
        .fixed_fingerprint_seed
        .or_else(|| {
            previous
                .and_then(|value| value.advanced.as_ref())
                .and_then(|value| value.fixed_fingerprint_seed)
        })
        .or_else(|| previous_snapshot.and_then(|value| value.fingerprint_seed))
        .unwrap_or_else(|| {
            generate_random_seed(&format!(
                "{}:{}:{}",
                platform,
                basic.browser_version.as_deref().unwrap_or_default(),
                basic.device_preset_id.as_deref().unwrap_or_default()
            ))
        });
    advanced.fixed_fingerprint_seed = Some(persisted_fixed_seed);

    let fixed_seed = match resolved_source.seed_policy {
        Some(FingerprintSeedPolicy::Fixed) => Some(persisted_fixed_seed),
        _ => previous_snapshot
            .and_then(|value| value.fingerprint_seed)
            .or(Some(persisted_fixed_seed)),
    };

    let snapshot = if let Some(snapshot) = fingerprint.fingerprint_snapshot.clone() {
        snapshot
    } else {
        let preset = device_preset_service.resolve_preset(
            platform.as_str(),
            resolved_source.device_preset_id.as_deref(),
        )?;
        let mut snapshot = fingerprint_catalog::resolve_fingerprint_snapshot_from_preset(
            &preset,
            &resolved_source,
            fingerprint.language.as_deref(),
            fingerprint.timezone_id.as_deref(),
            fixed_seed,
        )?;
        apply_font_list_mode(
            &mut snapshot,
            font_list_mode,
            fingerprint.custom_font_list.as_ref(),
            fixed_seed,
        )?;
        apply_legacy_fingerprint_overrides(
            &mut snapshot,
            fingerprint,
            !has_current_strong_fingerprint
                && previous_source.is_none()
                && previous_snapshot.is_none(),
        );
        apply_resolution_overrides(&mut snapshot, fingerprint);
        snapshot
    };

    fingerprint.fingerprint_source = Some(resolved_source);
    fingerprint.user_agent_mode = snapshot.user_agent.as_ref().map(|_| UserAgentMode::Custom);
    fingerprint.user_agent = snapshot.user_agent.clone();
    fingerprint.language = snapshot.language.clone();
    fingerprint.timezone_id = snapshot.time_zone.clone();
    fingerprint.font_list_mode = Some(font_list_mode);
    fingerprint.custom_cpu_cores = snapshot.custom_cpu_cores;
    fingerprint.custom_ram_gb = snapshot.custom_ram_gb;
    fingerprint.custom_font_list = match font_list_mode {
        FontListMode::Custom => snapshot.custom_font_list.clone(),
        _ => None,
    };
    fingerprint.fingerprint_snapshot = Some(snapshot);

    if settings.advanced.as_ref().is_some_and(|advanced| {
        advanced.headless.is_none()
            && advanced.disable_images.is_none()
            && advanced.plugin_selections.is_none()
            && advanced.geolocation_mode.is_none()
            && advanced.auto_allow_geolocation.is_none()
            && advanced.geolocation.is_none()
            && advanced.custom_launch_args.is_none()
            && advanced.random_fingerprint.is_none()
            && advanced.fixed_fingerprint_seed.is_none()
    }) {
        settings.advanced = None;
    }

    Ok(())
}

fn has_strong_fingerprint_settings(
    current: Option<&ProfileFingerprintSettings>,
    previous: Option<&ProfileFingerprintSettings>,
) -> bool {
    current.is_some_and(|value| {
        value.fingerprint_source.is_some() || value.fingerprint_snapshot.is_some()
    }) || previous.is_some_and(|value| {
        value.fingerprint_source.is_some() || value.fingerprint_snapshot.is_some()
    })
}

fn apply_legacy_fingerprint_overrides(
    snapshot: &mut ProfileFingerprintSnapshot,
    fingerprint: &ProfileFingerprintSettings,
    should_apply: bool,
) {
    if !should_apply {
        return;
    }
    if let Some(user_agent) = fingerprint.user_agent.clone() {
        snapshot.user_agent = Some(user_agent);
    }
    if let Some(language) = fingerprint.language.clone() {
        snapshot.accept_languages = Some(build_accept_languages(&language));
        snapshot.language = Some(language);
    }
    if let Some(time_zone) = fingerprint.timezone_id.clone() {
        snapshot.time_zone = Some(time_zone);
    }
    if let Some(custom_cpu_cores) = fingerprint.custom_cpu_cores {
        snapshot.custom_cpu_cores = Some(custom_cpu_cores);
    }
    if let Some(custom_ram_gb) = fingerprint.custom_ram_gb {
        snapshot.custom_ram_gb =
            Some(custom_ram_gb.min(fingerprint_catalog::MAX_FINGERPRINT_RAM_GB));
    }
    if let Some(custom_font_list) = fingerprint.custom_font_list.clone() {
        snapshot.custom_font_list = Some(custom_font_list);
    }
}

fn apply_resolution_overrides(
    snapshot: &mut ProfileFingerprintSnapshot,
    fingerprint: &ProfileFingerprintSettings,
) {
    if let Some(width) = fingerprint.viewport_width {
        snapshot.window_width = Some(width);
    }
    if let Some(height) = fingerprint.viewport_height {
        snapshot.window_height = Some(height);
    }
    if let Some(device_scale_factor) = fingerprint.device_scale_factor {
        snapshot.device_scale_factor = Some(device_scale_factor);
    }
}

fn is_valid_custom_device_name(value: &str) -> bool {
    let bytes = value.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 63
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
}

fn is_valid_custom_mac_address(value: &str) -> bool {
    let parts = value.split(':').collect::<Vec<_>>();
    parts.len() == 6
        && parts
            .iter()
            .all(|part| part.len() == 2 && part.chars().all(|ch| ch.is_ascii_hexdigit()))
}

fn parse_cookie_state_json(value: &str) -> Result<CookieStateFile, String> {
    let parsed = serde_json::from_str::<CookieStateFile>(value)
        .map_err(|err| format!("must be valid JSON: {err}"))?;
    for cookie in &parsed.managed_cookies {
        if cookie.cookie_id.trim().is_empty()
            || cookie.url.trim().is_empty()
            || cookie.name.trim().is_empty()
        {
            return Err("must include cookie_id, url, name, value for each cookie".to_string());
        }
        if !matches!(
            cookie.url.trim(),
            url if url.starts_with("http://") || url.starts_with("https://")
        ) {
            return Err("url must start with http:// or https://".to_string());
        }
    }
    Ok(parsed)
}

fn apply_font_list_mode(
    snapshot: &mut ProfileFingerprintSnapshot,
    mode: FontListMode,
    custom_font_list: Option<&Vec<String>>,
    seed: Option<u32>,
) -> AppResult<()> {
    let fonts = font_catalog::resolve_fonts_for_mode(
        snapshot.platform.as_deref(),
        mode,
        custom_font_list,
        seed,
    )?;
    snapshot.custom_font_list = Some(fonts);
    Ok(())
}

fn normalize_fingerprint_source(source: Option<&mut ProfileFingerprintSource>) {
    let Some(source) = source else {
        return;
    };
    source.platform = source.platform.take().and_then(trim_to_option);
    source.device_preset_id = source.device_preset_id.take().and_then(trim_to_option);
    source.browser_version = source.browser_version.take().and_then(trim_to_option);
    source.catalog_version = source.catalog_version.take().and_then(trim_to_option);
}

fn normalize_fingerprint_snapshot(snapshot: Option<&mut ProfileFingerprintSnapshot>) {
    let Some(snapshot) = snapshot else {
        return;
    };
    snapshot.browser_version = snapshot.browser_version.take().and_then(trim_to_option);
    snapshot.platform = snapshot.platform.take().and_then(trim_to_option);
    snapshot.platform_version = snapshot.platform_version.take().and_then(trim_to_option);
    snapshot.preset_label = snapshot.preset_label.take().and_then(trim_to_option);
    snapshot.form_factor = snapshot.form_factor.take().and_then(trim_to_option);
    snapshot.user_agent = snapshot.user_agent.take().and_then(trim_to_option);
    snapshot.custom_ua_metadata = snapshot.custom_ua_metadata.take().and_then(trim_to_option);
    snapshot.custom_platform = snapshot.custom_platform.take().and_then(trim_to_option);
    snapshot.custom_gl_vendor = snapshot.custom_gl_vendor.take().and_then(trim_to_option);
    snapshot.custom_gl_renderer = snapshot.custom_gl_renderer.take().and_then(trim_to_option);
    snapshot.custom_font_list = snapshot.custom_font_list.take().and_then(|items| {
        let normalized = items
            .into_iter()
            .filter_map(trim_to_option)
            .collect::<Vec<_>>();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    });
    snapshot.language = snapshot.language.take().and_then(trim_to_option);
    snapshot.accept_languages = snapshot.accept_languages.take().and_then(trim_to_option);
    snapshot.time_zone = snapshot.time_zone.take().and_then(trim_to_option);
}

fn build_accept_languages(language: &str) -> String {
    let primary = language.trim();
    if primary.is_empty() {
        return String::new();
    }
    let base = primary.split('-').next().unwrap_or(primary).trim();
    if base.eq_ignore_ascii_case(primary) {
        format!("{primary},en;q=0.8")
    } else {
        format!("{primary},{base};q=0.9,en;q=0.8")
    }
}

fn parse_profile_id(profile_id: &str) -> AppResult<i64> {
    let value = profile_id.strip_prefix("pf_").unwrap_or(profile_id);
    value
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid profile id: {profile_id}")))
}

fn format_profile_id(id: i64) -> String {
    format!("pf_{id:06}")
}

fn normalize_browser_bg_color_mode(
    mode: Option<BrowserBgColorMode>,
    has_browser_bg_color: bool,
) -> Option<BrowserBgColorMode> {
    match mode {
        Some(mode) => Some(mode),
        None if has_browser_bg_color => Some(BrowserBgColorMode::Custom),
        None => None,
    }
}

fn normalize_toolbar_label_mode(mode: Option<ToolbarLabelMode>) -> Option<ToolbarLabelMode> {
    mode
}

fn resolve_effective_browser_bg_color_mode(
    basic: Option<&crate::models::ProfileBasicSettings>,
) -> BrowserBgColorMode {
    match basic.and_then(|value| normalize_browser_bg_color_mode(value.browser_bg_color_mode, value.browser_bg_color.is_some())) {
        Some(mode) => mode,
        None => BrowserBgColorMode::Inherit,
    }
}

fn trim_str_to_option(input: &str) -> Option<String> {
    trim_to_option(input.to_string())
}

fn parse_toolbar_label_mode(value: &str) -> ToolbarLabelMode {
    match value {
        "group_name_and_id" => ToolbarLabelMode::GroupNameAndId,
        _ => ToolbarLabelMode::IdOnly,
    }
}

fn trim_to_option(input: String) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn normalize_startup_urls(
    startup_urls: Option<Vec<String>>,
    legacy_startup_url: Option<String>,
) -> AppResult<Option<Vec<String>>> {
    let mut normalized = startup_urls
        .unwrap_or_default()
        .into_iter()
        .filter_map(trim_to_option)
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        if let Some(legacy) = legacy_startup_url {
            normalized.push(legacy);
        }
    }

    if normalized.is_empty() {
        return Ok(None);
    }

    for startup_url in &normalized {
        if !startup_url.starts_with("http://") && !startup_url.starts_with("https://") {
            return Err(AppError::Validation("invalid startupUrl".to_string()));
        }
    }

    Ok(Some(normalized))
}

fn generate_random_seed(seed_hint: &str) -> u32 {
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    let now_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    now_nanos.hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    seed_hint.hash(&mut hasher);
    (hasher.finish() & u64::from(u32::MAX)) as u32
}

fn normalize_hex_color(input: String) -> AppResult<String> {
    let value = input.trim();
    if value.len() != 7 || !value.starts_with('#') {
        return Err(AppError::Validation(
            "browserBgColor must be a hex color like #0F8A73".to_string(),
        ));
    }
    let hex = &value[1..];
    if !hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(AppError::Validation(
            "browserBgColor must be a hex color like #0F8A73".to_string(),
        ));
    }
    Ok(format!("#{}", hex.to_uppercase()))
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
    use crate::models::{
        CreateProfileGroupRequest, CreateProfileRequest, ProfileBasicSettings,
        ProfileFingerprintSettings, ProfileFingerprintSource, ProfileSettings, UserAgentMode,
    };
    use crate::services::profile_group_service::ProfileGroupService;
    use sea_orm::ConnectionTrait;

    #[test]
    fn list_profiles_supports_filters_and_pagination() {
        let db = db::init_test_database().expect("init test db");
        let group_service = ProfileGroupService::from_db(db.clone());
        let service = ProfileService::from_db(db);

        group_service
            .create_group(CreateProfileGroupRequest {
                name: "g1".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create g1");
        group_service
            .create_group(CreateProfileGroupRequest {
                name: "g2".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create g2");

        let p1 = service
            .create_profile(CreateProfileRequest {
                name: "alpha".to_string(),
                group: Some("g1".to_string()),
                note: Some("note-a".to_string()),
                proxy_id: None,
                settings: None,
            })
            .expect("create profile alpha");

        let p2 = service
            .create_profile(CreateProfileRequest {
                name: "beta".to_string(),
                group: Some("g2".to_string()),
                note: Some("note-b".to_string()),
                proxy_id: None,
                settings: None,
            })
            .expect("create profile beta");

        let _p3 = service
            .create_profile(CreateProfileRequest {
                name: "gamma".to_string(),
                group: Some("g2".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile gamma");

        service
            .soft_delete_profile(&p2.id)
            .expect("soft delete beta");
        service
            .mark_profile_running(&p1.id, true)
            .expect("mark alpha running");

        let page1 = service
            .list_profiles(ListProfilesQuery {
                include_deleted: false,
                page: 1,
                page_size: 1,
                keyword: None,
                group: None,
                running: None,
            })
            .expect("list page1");
        assert_eq!(page1.total, 2);
        assert_eq!(page1.total_pages, 2);
        assert_eq!(page1.items.len(), 1);

        let group_filtered = service
            .list_profiles(ListProfilesQuery {
                include_deleted: true,
                page: 1,
                page_size: 20,
                keyword: None,
                group: Some("g2".to_string()),
                running: None,
            })
            .expect("list group filtered");
        assert_eq!(group_filtered.total, 2);

        let keyword_filtered = service
            .list_profiles(ListProfilesQuery {
                include_deleted: true,
                page: 1,
                page_size: 20,
                keyword: Some("alp".to_string()),
                group: None,
                running: None,
            })
            .expect("list keyword filtered");
        assert_eq!(keyword_filtered.total, 1);
        assert_eq!(keyword_filtered.items[0].name, "alpha");

        let running_filtered = service
            .list_profiles(ListProfilesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: None,
                group: None,
                running: Some(true),
            })
            .expect("list running filtered");
        assert_eq!(running_filtered.total, 1);
        assert_eq!(running_filtered.items[0].name, "alpha");
    }

    #[test]
    fn set_profile_group_updates_and_clears_group_name() {
        let db = db::init_test_database().expect("init test db");
        let group_service = ProfileGroupService::from_db(db.clone());
        let service = ProfileService::from_db(db);

        group_service
            .create_group(CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create growth group");

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "alpha".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let grouped = service
            .set_profile_group(&profile.id, Some("growth".to_string()))
            .expect("set group");
        assert_eq!(grouped.group.as_deref(), Some("growth"));

        let cleared = service
            .set_profile_group(&profile.id, None)
            .expect("clear group");
        assert_eq!(cleared.group, None);
    }

    #[test]
    fn profiles_expose_numeric_id_and_visual_inheritance_in_api_payload() {
        let db = db::init_test_database().expect("init test db");
        let group_service = ProfileGroupService::from_db(db.clone());
        let service = ProfileService::from_db(db.clone());

        group_service
            .create_group(CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create growth group");

        crate::runtime_compat::block_on_compat(db.execute_unprepared(
            "UPDATE profile_groups SET browser_bg_color = '#0F8A73', toolbar_label_mode = 'group_name_and_id' WHERE name = 'growth'",
        ))
        .expect("seed group visual defaults");

        let inherited = service
            .create_profile(CreateProfileRequest {
                name: "alpha".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_bg_color: None,
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create inherited profile");

        let custom = service
            .create_profile(CreateProfileRequest {
                name: "beta".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create custom profile");
        let custom_numeric_id = custom.id.clone();

        crate::runtime_compat::block_on_compat(db.execute_unprepared(&format!(
            concat!(
                "UPDATE profiles SET settings_json = '{{",
                "\"basic\":{{",
                "\"browserBgColorMode\":\"none\",",
                "\"toolbarLabelMode\":\"id_only\"",
                "}}",
                "}}' WHERE id = {}"
            ),
            parse_profile_id(&custom_numeric_id).expect("parse profile id"),
        )))
        .expect("seed custom visual settings");

        let listed = service
            .list_profiles(ListProfilesQuery {
                include_deleted: false,
                page: 1,
                page_size: 20,
                keyword: None,
                group: None,
                running: None,
            })
            .expect("list profiles");

        let inherited_json = serde_json::to_value(
            listed
                .items
                .iter()
                .find(|item| item.id == inherited.id)
                .expect("find inherited"),
        )
        .expect("serialize inherited");
        assert_eq!(inherited_json.get("numericId").and_then(|value| value.as_i64()), Some(1));
        assert_eq!(
            inherited_json
                .get("resolvedToolbarText")
                .and_then(|value| value.as_str()),
            Some("growth-1")
        );
        assert_eq!(
            inherited_json
                .get("resolvedBrowserBgColor")
                .and_then(|value| value.as_str()),
            Some("#0F8A73")
        );

        let custom_json = serde_json::to_value(
            listed
                .items
                .iter()
                .find(|item| item.id == custom_numeric_id)
                .expect("find custom"),
        )
        .expect("serialize custom");
        assert_eq!(custom_json.get("numericId").and_then(|value| value.as_i64()), Some(2));
        assert_eq!(
            custom_json
                .get("resolvedToolbarText")
                .and_then(|value| value.as_str()),
            Some("2")
        );
        assert!(custom_json.get("resolvedBrowserBgColor").is_some_and(|value| value.is_null()));
    }

    #[test]
    fn strong_fingerprint_ignores_invalid_legacy_flat_fields() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "strong-fingerprint".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("windows".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        ..Default::default()
                    }),
                    fingerprint: Some(ProfileFingerprintSettings {
                        fingerprint_source: Some(ProfileFingerprintSource {
                            platform: Some("windows".to_string()),
                            device_preset_id: Some("windows_11_desktop".to_string()),
                            browser_version: Some("144.0.7559.97".to_string()),
                            ..Default::default()
                        }),
                        user_agent_mode: Some(UserAgentMode::Custom),
                        custom_cpu_cores: Some(0),
                        custom_ram_gb: Some(0),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with strong fingerprint");

        let snapshot = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .and_then(|fingerprint| fingerprint.fingerprint_snapshot.as_ref())
            .expect("fingerprint snapshot");
        assert_ne!(snapshot.custom_cpu_cores, Some(0));
        assert_ne!(snapshot.custom_ram_gb, Some(0));
        assert!(snapshot
            .user_agent
            .as_deref()
            .is_some_and(|value| value.contains("Chrome/144.0.7559.97")));
    }

    #[test]
    fn legacy_flat_fields_still_hydrate_snapshot() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "legacy-fingerprint".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        ..Default::default()
                    }),
                    fingerprint: Some(ProfileFingerprintSettings {
                        user_agent_mode: Some(UserAgentMode::Custom),
                        user_agent: Some("Mozilla/5.0 legacy".to_string()),
                        language: Some("fr-FR".to_string()),
                        timezone_id: Some("Europe/Paris".to_string()),
                        custom_cpu_cores: Some(12),
                        custom_ram_gb: Some(24),
                        custom_font_list: Some(vec!["Arial".to_string(), "Helvetica".to_string()]),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create legacy profile");

        let snapshot = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .and_then(|fingerprint| fingerprint.fingerprint_snapshot.as_ref())
            .expect("fingerprint snapshot");
        assert_eq!(snapshot.user_agent.as_deref(), Some("Mozilla/5.0 legacy"));
        assert_eq!(snapshot.language.as_deref(), Some("fr-FR"));
        assert_eq!(snapshot.time_zone.as_deref(), Some("Europe/Paris"));
        assert_eq!(snapshot.custom_cpu_cores, Some(12));
        assert_eq!(snapshot.custom_ram_gb, Some(8));
        assert_eq!(
            snapshot.custom_font_list.as_ref(),
            Some(&vec!["Arial".to_string(), "Helvetica".to_string()])
        );
    }

    #[test]
    fn fingerprint_resolution_overrides_are_persisted_into_snapshot() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "resolution-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("macos_macbook_pro_14".to_string()),
                        ..Default::default()
                    }),
                    fingerprint: Some(ProfileFingerprintSettings {
                        fingerprint_source: Some(ProfileFingerprintSource {
                            platform: Some("macos".to_string()),
                            device_preset_id: Some("macos_macbook_pro_14".to_string()),
                            browser_version: Some("144.0.7559.97".to_string()),
                            ..Default::default()
                        }),
                        viewport_width: Some(1728),
                        viewport_height: Some(1117),
                        device_scale_factor: Some(1.5),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with resolution override");

        let snapshot = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .and_then(|fingerprint| fingerprint.fingerprint_snapshot.as_ref())
            .expect("fingerprint snapshot");
        assert_eq!(snapshot.window_width, Some(1728));
        assert_eq!(snapshot.window_height, Some(1117));
        assert_eq!(snapshot.device_scale_factor, Some(1.5));
    }

    #[test]
    fn do_not_track_setting_is_preserved_in_fingerprint_settings() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "dnt-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("macos_macbook_pro_14".to_string()),
                        ..Default::default()
                    }),
                    fingerprint: Some(ProfileFingerprintSettings {
                        do_not_track_enabled: Some(true),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with do not track");

        let fingerprint = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .expect("fingerprint settings");
        assert_eq!(fingerprint.do_not_track_enabled, Some(true));
    }

    #[test]
    fn cookie_state_json_is_preserved_in_advanced_settings() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "cookie-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("macos_macbook_pro_14".to_string()),
                        ..Default::default()
                    }),
                    advanced: Some(crate::models::ProfileAdvancedSettings {
                        cookie_state_json: Some(
                            r#"{"environment_id":"env_1","managed_cookies":[{"cookie_id":"ck_1","url":"https://example.com/","name":"sid","value":"abc"}]}"#
                                .to_string(),
                        ),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with cookie state");

        let advanced = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.advanced.as_ref())
            .expect("advanced settings");
        assert!(advanced
            .cookie_state_json
            .as_deref()
            .is_some_and(|value| value.contains("\"managed_cookies\"")));
    }

    #[test]
    fn invalid_cookie_state_json_is_rejected() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let err = service
            .create_profile(CreateProfileRequest {
                name: "invalid-cookie-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("macos_macbook_pro_14".to_string()),
                        ..Default::default()
                    }),
                    advanced: Some(crate::models::ProfileAdvancedSettings {
                        cookie_state_json: Some(r#"{"managed_cookies":"bad"}"#.to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect_err("invalid cookie state should fail");

        assert!(err.to_string().contains("cookieStateJson"));
    }

    #[test]
    fn custom_device_identity_settings_are_preserved_in_fingerprint_settings() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "device-identity-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("macos_macbook_pro_14".to_string()),
                        ..Default::default()
                    }),
                    fingerprint: Some(ProfileFingerprintSettings {
                        device_name_mode: Some(crate::models::CustomValueMode::Custom),
                        custom_device_name: Some("device-a1b2c3d4".to_string()),
                        mac_address_mode: Some(crate::models::CustomValueMode::Custom),
                        custom_mac_address: Some("A2:11:22:33:44:55".to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with custom device identity");

        let fingerprint = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.fingerprint.as_ref())
            .expect("fingerprint settings");
        assert_eq!(
            fingerprint.device_name_mode,
            Some(crate::models::CustomValueMode::Custom)
        );
        assert_eq!(
            fingerprint.custom_device_name.as_deref(),
            Some("device-a1b2c3d4")
        );
        assert_eq!(
            fingerprint.mac_address_mode,
            Some(crate::models::CustomValueMode::Custom)
        );
        assert_eq!(
            fingerprint.custom_mac_address.as_deref(),
            Some("A2:11:22:33:44:55")
        );
    }

    #[test]
    fn profile_basic_settings_supports_legacy_and_multi_startup_urls() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "startup-profile".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("macos".to_string()),
                        startup_url: Some("https://legacy.example".to_string()),
                        startup_urls: Some(vec![
                            "https://first.example".to_string(),
                            "https://second.example".to_string(),
                        ]),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile with startup urls");

        let startup_urls = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.basic.as_ref())
            .and_then(|basic| basic.startup_urls.as_ref())
            .expect("startup urls should exist");
        assert_eq!(
            startup_urls,
            &vec![
                "https://first.example".to_string(),
                "https://second.example".to_string()
            ]
        );
    }

    #[test]
    fn create_profile_generates_distinct_fixed_seed_by_default() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let first = service
            .create_profile(CreateProfileRequest {
                name: "seed-one".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("windows".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        ..Default::default()
                    }),
                    advanced: Some(crate::models::ProfileAdvancedSettings {
                        random_fingerprint: Some(false),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create first profile");
        let second = service
            .create_profile(CreateProfileRequest {
                name: "seed-two".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("windows".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        ..Default::default()
                    }),
                    advanced: Some(crate::models::ProfileAdvancedSettings {
                        random_fingerprint: Some(false),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create second profile");

        let first_seed = first
            .settings
            .as_ref()
            .and_then(|settings| settings.advanced.as_ref())
            .and_then(|settings| settings.fixed_fingerprint_seed)
            .expect("first fixed seed");
        let second_seed = second
            .settings
            .as_ref()
            .and_then(|settings| settings.advanced.as_ref())
            .and_then(|settings| settings.fixed_fingerprint_seed)
            .expect("second fixed seed");

        assert_ne!(first_seed, second_seed);
    }

    #[test]
    fn random_fingerprint_preserves_persisted_fixed_seed() {
        let db = db::init_test_database().expect("init test db");
        let service = ProfileService::from_db(db);

        let profile = service
            .create_profile(CreateProfileRequest {
                name: "random-seed".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: Some(ProfileSettings {
                    basic: Some(ProfileBasicSettings {
                        platform: Some("windows".to_string()),
                        browser_version: Some("144.0.7559.97".to_string()),
                        device_preset_id: Some("windows_11_desktop".to_string()),
                        ..Default::default()
                    }),
                    advanced: Some(crate::models::ProfileAdvancedSettings {
                        random_fingerprint: Some(true),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            })
            .expect("create profile");

        let fixed_seed = profile
            .settings
            .as_ref()
            .and_then(|settings| settings.advanced.as_ref())
            .and_then(|settings| settings.fixed_fingerprint_seed)
            .expect("persisted fixed seed");

        assert!(fixed_seed > 0);
    }
}
