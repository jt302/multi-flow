use std::future::Future;

use sea_orm::sea_query::Expr;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set,
};

use crate::db::entities::{profile, profile_group};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, CreateProfileGroupRequest, ListProfileGroupsResponse, ProfileGroup,
    ProfileGroupLifecycle, ToolbarLabelMode, UpdateProfileGroupRequest,
};

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";

pub struct ProfileGroupService {
    db: DatabaseConnection,
}

impl ProfileGroupService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_group(&self, req: CreateProfileGroupRequest) -> AppResult<ProfileGroup> {
        let name = require_name(req.name)?;
        let note = req.note.and_then(trim_to_option);
        let browser_bg_color = req
            .browser_bg_color
            .and_then(trim_to_option)
            .map(normalize_hex_color)
            .transpose()?;
        let toolbar_label_mode = req.toolbar_label_mode.unwrap_or(ToolbarLabelMode::IdOnly);

        let exists = self.db_query(
            profile_group::Entity::find()
                .filter(profile_group::Column::Name.eq(name.clone()))
                .filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .one(&self.db),
        )?;
        if exists.is_some() {
            return Err(AppError::Conflict(format!("group already exists: {name}")));
        }

        let now = now_ts();
        let model = profile_group::ActiveModel {
            name: Set(name),
            note: Set(note),
            browser_bg_color: Set(browser_bg_color),
            toolbar_label_mode: Set(toolbar_label_mode_as_str(toolbar_label_mode).to_string()),
            lifecycle: Set(LIFECYCLE_ACTIVE.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            deleted_at: Set(None),
            ..Default::default()
        };

        let inserted = self.db_query(profile_group::Entity::insert(model).exec(&self.db))?;
        let created = self.find_group_by_pk(inserted.last_insert_id)?;
        self.to_api_group(created)
    }

    pub fn list_groups(&self, include_deleted: bool) -> AppResult<ListProfileGroupsResponse> {
        let mut query = profile_group::Entity::find();
        if !include_deleted {
            query = query.filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE));
        }
        let rows = self.db_query(
            query
                .order_by_asc(profile_group::Column::CreatedAt)
                .all(&self.db),
        )?;
        let mut items = Vec::with_capacity(rows.len());
        for item in rows {
            items.push(self.to_api_group(item)?);
        }
        Ok(ListProfileGroupsResponse {
            total: items.len(),
            items,
        })
    }

    pub fn update_group(
        &self,
        group_id: &str,
        req: UpdateProfileGroupRequest,
    ) -> AppResult<ProfileGroup> {
        let stored = self.find_group(group_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "group already deleted: {group_id}"
            )));
        }

        let name = require_name(req.name)?;
        let note = req.note.and_then(trim_to_option);
        let browser_bg_color = req
            .browser_bg_color
            .and_then(trim_to_option)
            .map(normalize_hex_color)
            .transpose()?;
        let toolbar_label_mode = req.toolbar_label_mode.unwrap_or(ToolbarLabelMode::IdOnly);
        let duplicate = self.db_query(
            profile_group::Entity::find()
                .filter(profile_group::Column::Name.eq(name.clone()))
                .filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .one(&self.db),
        )?;
        if duplicate.as_ref().is_some_and(|item| item.id != stored.id) {
            return Err(AppError::Conflict(format!("group already exists: {name}")));
        }

        if stored.name != name {
            self.db_query(
                profile::Entity::update_many()
                    .col_expr(profile::Column::GroupName, Expr::value(Some(name.clone())))
                    .filter(profile::Column::GroupName.eq(stored.name.clone()))
                    .exec(&self.db),
            )?;
        }

        let mut active_model: profile_group::ActiveModel = stored.into();
        active_model.name = Set(name);
        active_model.note = Set(note);
        active_model.browser_bg_color = Set(browser_bg_color);
        active_model.toolbar_label_mode =
            Set(toolbar_label_mode_as_str(toolbar_label_mode).to_string());
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        self.to_api_group(updated)
    }

    pub fn soft_delete_group(&self, group_id: &str) -> AppResult<ProfileGroup> {
        let stored = self.find_group(group_id)?;
        if stored.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "group already deleted: {group_id}"
            )));
        }

        let now = now_ts();
        let mut active_model: profile_group::ActiveModel = stored.clone().into();
        active_model.lifecycle = Set(LIFECYCLE_DELETED.to_string());
        active_model.deleted_at = Set(Some(now));
        active_model.updated_at = Set(now);
        let updated = self.db_query(active_model.update(&self.db))?;

        self.db_query(
            profile::Entity::update_many()
                .col_expr(profile::Column::GroupName, Expr::value(None::<String>))
                .filter(profile::Column::GroupName.eq(stored.name))
                .exec(&self.db),
        )?;

        self.to_api_group(updated)
    }

    pub fn restore_group(&self, group_id: &str) -> AppResult<ProfileGroup> {
        let stored = self.find_group(group_id)?;
        if stored.lifecycle == LIFECYCLE_ACTIVE {
            return Err(AppError::Conflict(format!("group not deleted: {group_id}")));
        }

        let duplicate = self.db_query(
            profile_group::Entity::find()
                .filter(profile_group::Column::Name.eq(stored.name.clone()))
                .filter(profile_group::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .one(&self.db),
        )?;
        if duplicate.is_some() {
            return Err(AppError::Conflict(format!(
                "cannot restore group, active group with same name exists: {}",
                stored.name
            )));
        }

        let mut active_model: profile_group::ActiveModel = stored.into();
        active_model.lifecycle = Set(LIFECYCLE_ACTIVE.to_string());
        active_model.deleted_at = Set(None);
        active_model.updated_at = Set(now_ts());
        let updated = self.db_query(active_model.update(&self.db))?;
        self.to_api_group(updated)
    }

    pub fn purge_group(&self, group_id: &str) -> AppResult<()> {
        let stored = self.find_group(group_id)?;
        if stored.lifecycle != LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!(
                "group must be deleted before purge: {group_id}"
            )));
        }

        self.db_query(profile_group::Entity::delete_by_id(stored.id).exec(&self.db))?;
        Ok(())
    }

    fn find_group(&self, group_id: &str) -> AppResult<profile_group::Model> {
        let id = parse_group_id(group_id)?;
        self.find_group_by_pk(id)
    }

    fn find_group_by_pk(&self, id: i64) -> AppResult<profile_group::Model> {
        let row = self.db_query(profile_group::Entity::find_by_id(id).one(&self.db))?;
        row.ok_or_else(|| AppError::NotFound(format!("group not found: {}", format_group_id(id))))
    }
    fn to_api_group(&self, model: profile_group::Model) -> AppResult<ProfileGroup> {
        let profile_count = self.db_query(
            profile::Entity::find()
                .filter(profile::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .filter(profile::Column::GroupName.eq(model.name.clone()))
                .count(&self.db),
        )? as usize;

        Ok(ProfileGroup {
            id: format_group_id(model.id),
            name: model.name,
            note: model.note,
            browser_bg_color: model.browser_bg_color,
            toolbar_label_mode: parse_toolbar_label_mode(&model.toolbar_label_mode),
            lifecycle: if model.lifecycle == LIFECYCLE_DELETED {
                ProfileGroupLifecycle::Deleted
            } else {
                ProfileGroupLifecycle::Active
            },
            profile_count,
            created_at: model.created_at,
            updated_at: model.updated_at,
            deleted_at: model.deleted_at,
        })
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }
}

fn require_name(value: String) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("group name is required".to_string()));
    }
    Ok(trimmed.to_string())
}

fn trim_to_option(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_group_id(group_id: &str) -> AppResult<i64> {
    group_id
        .strip_prefix("pg_")
        .unwrap_or(group_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid group id: {group_id}")))
}

fn format_group_id(id: i64) -> String {
    format!("pg_{id:06}")
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

fn toolbar_label_mode_as_str(mode: ToolbarLabelMode) -> &'static str {
    match mode {
        ToolbarLabelMode::IdOnly => "id_only",
        ToolbarLabelMode::GroupNameAndId => "group_name_and_id",
    }
}

fn parse_toolbar_label_mode(value: &str) -> ToolbarLabelMode {
    match value {
        "group_name_and_id" => ToolbarLabelMode::GroupNameAndId,
        _ => ToolbarLabelMode::IdOnly,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::CreateProfileRequest;
    use crate::services::profile_service::ProfileService;
    use sea_orm::ConnectionTrait;

    #[test]
    fn create_list_delete_restore_group_with_profile_count() {
        let db = db::init_test_database().expect("init db");
        let profile_service = ProfileService::from_db(db.clone());
        let group_service = ProfileGroupService::from_db(db);

        let group = group_service
            .create_group(CreateProfileGroupRequest {
                name: "AirDrop".to_string(),
                note: Some("test".to_string()),
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create group");

        profile_service
            .create_profile(CreateProfileRequest {
                name: "p1".to_string(),
                group: Some("AirDrop".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create p1");
        profile_service
            .create_profile(CreateProfileRequest {
                name: "p2".to_string(),
                group: Some("AirDrop".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create p2");

        let listed = group_service.list_groups(false).expect("list groups");
        assert_eq!(listed.total, 1);
        assert_eq!(listed.items[0].profile_count, 2);

        let deleted = group_service
            .soft_delete_group(&group.id)
            .expect("delete group");
        assert!(matches!(deleted.lifecycle, ProfileGroupLifecycle::Deleted));

        let listed_after_delete = group_service.list_groups(false).expect("list groups");
        assert_eq!(listed_after_delete.total, 0);

        let restored = group_service
            .restore_group(&group.id)
            .expect("restore group");
        assert!(matches!(restored.lifecycle, ProfileGroupLifecycle::Active));
    }

    #[test]
    fn update_group_renames_profiles_and_rejects_duplicates() {
        let db = db::init_test_database().expect("init db");
        let profile_service = ProfileService::from_db(db.clone());
        let group_service = ProfileGroupService::from_db(db);

        let source = group_service
            .create_group(CreateProfileGroupRequest {
                name: "Legacy".to_string(),
                note: Some("old".to_string()),
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create source group");
        let _other = group_service
            .create_group(CreateProfileGroupRequest {
                name: "Reserved".to_string(),
                note: None,
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create other group");

        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "rename-target".to_string(),
                group: Some("Legacy".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let updated = group_service
            .update_group(
                &source.id,
                UpdateProfileGroupRequest {
                    name: "Growth".to_string(),
                    note: Some("new".to_string()),
                    browser_bg_color: None,
                    toolbar_label_mode: None,
                },
            )
            .expect("update group");
        assert_eq!(updated.name, "Growth");

        let refreshed_profile = profile_service
            .get_profile(&profile.id)
            .expect("refresh profile");
        assert_eq!(refreshed_profile.group.as_deref(), Some("Growth"));

        let duplicate_err = group_service
            .update_group(
                &source.id,
                UpdateProfileGroupRequest {
                    name: "Reserved".to_string(),
                    note: None,
                    browser_bg_color: None,
                    toolbar_label_mode: None,
                },
            )
            .expect_err("duplicate rename should fail");
        assert!(duplicate_err.to_string().contains("group already exists"));
    }

    #[test]
    fn list_groups_returns_visual_defaults() {
        let db = db::init_test_database().expect("init db");
        let group_service = ProfileGroupService::from_db(db.clone());

        let group = group_service
            .create_group(CreateProfileGroupRequest {
                name: "Visual".to_string(),
                note: Some("style".to_string()),
                browser_bg_color: None,
                toolbar_label_mode: None,
            })
            .expect("create group");

        crate::runtime_compat::block_on_compat(db.execute_unprepared(&format!(
            "UPDATE profile_groups SET browser_bg_color = '#0F8A73', toolbar_label_mode = 'group_name_and_id' WHERE id = {}",
            parse_group_id(&group.id).expect("parse group id"),
        )))
        .expect("seed visual defaults");

        let listed = group_service.list_groups(false).expect("list groups");
        let serialized = serde_json::to_value(&listed.items[0]).expect("serialize group");

        assert_eq!(
            serialized
                .get("browserBgColor")
                .and_then(|value| value.as_str()),
            Some("#0F8A73")
        );
        assert_eq!(
            serialized
                .get("toolbarLabelMode")
                .and_then(|value| value.as_str()),
            Some("group_name_and_id")
        );
    }
}
