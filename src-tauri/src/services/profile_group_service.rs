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
    ProfileGroupLifecycle,
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
        tauri::async_runtime::block_on(future).map_err(AppError::from)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::CreateProfileRequest;
    use crate::services::profile_service::ProfileService;

    #[test]
    fn create_list_delete_restore_group_with_profile_count() {
        let db = db::init_test_database().expect("init db");
        let profile_service = ProfileService::from_db(db.clone());
        let group_service = ProfileGroupService::from_db(db);

        let group = group_service
            .create_group(CreateProfileGroupRequest {
                name: "AirDrop".to_string(),
                note: Some("test".to_string()),
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
}
