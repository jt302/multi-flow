use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use crate::db::entities::{profile, rpa_flow, rpa_flow_target};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, CreateRpaFlowRequest, RpaFlow, RpaFlowDefinition, RpaFlowLifecycle,
    UpdateRpaFlowRequest,
};

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";

pub struct RpaFlowService {
    db: DatabaseConnection,
}

impl RpaFlowService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_flow(&self, req: CreateRpaFlowRequest) -> AppResult<RpaFlow> {
        validate_flow_definition(&req.definition)?;
        validate_target_profile_ids(&self.db, &req.default_target_profile_ids)?;

        let now = now_ts();
        let defaults_json = serde_json::to_string(&req.definition.defaults)?;
        let definition_json = serde_json::to_string(&req.definition)?;
        let model = rpa_flow::ActiveModel {
            name: Set(require_non_empty("name", &req.name)?),
            note: Set(trim_option(req.note)),
            definition_json: Set(definition_json),
            defaults_json: Set(defaults_json),
            lifecycle: Set(LIFECYCLE_ACTIVE.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            deleted_at: Set(None),
            last_run_at: Set(None),
            ..Default::default()
        };
        let inserted = self.db_query(rpa_flow::Entity::insert(model).exec(&self.db))?;
        self.replace_targets(inserted.last_insert_id, &req.default_target_profile_ids)?;
        self.get_flow(&format_flow_id(inserted.last_insert_id))?
            .ok_or_else(|| AppError::NotFound("rpa flow missing right after create".to_string()))
    }

    pub fn update_flow(&self, flow_id: &str, req: UpdateRpaFlowRequest) -> AppResult<RpaFlow> {
        validate_flow_definition(&req.definition)?;
        validate_target_profile_ids(&self.db, &req.default_target_profile_ids)?;

        let existing = self.find_model(flow_id)?;
        let mut active_model: rpa_flow::ActiveModel = existing.into();
        active_model.name = Set(require_non_empty("name", &req.name)?);
        active_model.note = Set(trim_option(req.note));
        active_model.definition_json = Set(serde_json::to_string(&req.definition)?);
        active_model.defaults_json = Set(serde_json::to_string(&req.definition.defaults)?);
        active_model.updated_at = Set(now_ts());
        self.db_query(active_model.update(&self.db))?;
        let flow_pk = parse_flow_id(flow_id)?;
        self.replace_targets(flow_pk, &req.default_target_profile_ids)?;
        self.get_flow(flow_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa flow not found: {flow_id}")))
    }

    pub fn list_flows(&self, include_deleted: bool) -> AppResult<Vec<RpaFlow>> {
        let mut query = rpa_flow::Entity::find().order_by_asc(rpa_flow::Column::CreatedAt);
        if !include_deleted {
            query = query.filter(rpa_flow::Column::Lifecycle.eq(LIFECYCLE_ACTIVE));
        }
        let models = self.db_query(query.all(&self.db))?;
        let mut items = Vec::with_capacity(models.len());
        for model in models {
            items.push(self.to_api_flow(model)?);
        }
        Ok(items)
    }

    pub fn get_flow(&self, flow_id: &str) -> AppResult<Option<RpaFlow>> {
        let parsed = parse_flow_id(flow_id)?;
        let model = self.db_query(rpa_flow::Entity::find_by_id(parsed).one(&self.db))?;
        model.map(|item| self.to_api_flow(item)).transpose()
    }

    pub fn delete_flow(&self, flow_id: &str) -> AppResult<RpaFlow> {
        let existing = self.find_model(flow_id)?;
        let mut active_model: rpa_flow::ActiveModel = existing.into();
        if active_model.lifecycle.clone().unwrap() == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!("rpa flow already deleted: {flow_id}")));
        }
        let now = now_ts();
        active_model.lifecycle = Set(LIFECYCLE_DELETED.to_string());
        active_model.deleted_at = Set(Some(now));
        active_model.updated_at = Set(now);
        self.db_query(active_model.update(&self.db))?;
        self.get_flow(flow_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa flow not found: {flow_id}")))
    }

    pub fn restore_flow(&self, flow_id: &str) -> AppResult<RpaFlow> {
        let existing = self.find_model(flow_id)?;
        let mut active_model: rpa_flow::ActiveModel = existing.into();
        if active_model.lifecycle.clone().unwrap() == LIFECYCLE_ACTIVE {
            return Err(AppError::Conflict(format!("rpa flow not deleted: {flow_id}")));
        }
        active_model.lifecycle = Set(LIFECYCLE_ACTIVE.to_string());
        active_model.deleted_at = Set(None);
        active_model.updated_at = Set(now_ts());
        self.db_query(active_model.update(&self.db))?;
        self.get_flow(flow_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa flow not found: {flow_id}")))
    }

    pub fn purge_flow(&self, flow_id: &str) -> AppResult<()> {
        let flow_pk = parse_flow_id(flow_id)?;
        self.db_query(
            rpa_flow_target::Entity::delete_many()
                .filter(rpa_flow_target::Column::FlowId.eq(flow_pk))
                .exec(&self.db),
        )?;
        let delete_result = self.db_query(rpa_flow::Entity::delete_by_id(flow_pk).exec(&self.db))?;
        if delete_result.rows_affected == 0 {
            return Err(AppError::NotFound(format!("rpa flow not found: {flow_id}")));
        }
        Ok(())
    }

    pub fn touch_last_run(&self, flow_id: &str, ts: i64) -> AppResult<()> {
        let existing = self.find_model(flow_id)?;
        let mut active_model: rpa_flow::ActiveModel = existing.into();
        active_model.last_run_at = Set(Some(ts));
        active_model.updated_at = Set(ts);
        self.db_query(active_model.update(&self.db))?;
        Ok(())
    }

    fn replace_targets(&self, flow_pk: i64, profile_ids: &[String]) -> AppResult<()> {
        let now = now_ts();
        self.db_query(
            rpa_flow_target::Entity::delete_many()
                .filter(rpa_flow_target::Column::FlowId.eq(flow_pk))
                .exec(&self.db),
        )?;
        for profile_id in profile_ids {
            let profile_pk = parse_profile_id(profile_id)?;
            let model = rpa_flow_target::ActiveModel {
                flow_id: Set(flow_pk),
                profile_id: Set(profile_pk),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            self.db_query(rpa_flow_target::Entity::insert(model).exec(&self.db))?;
        }
        Ok(())
    }

    fn to_api_flow(&self, model: rpa_flow::Model) -> AppResult<RpaFlow> {
        let targets = self.db_query(
            rpa_flow_target::Entity::find()
                .filter(rpa_flow_target::Column::FlowId.eq(model.id))
                .order_by_asc(rpa_flow_target::Column::Id)
                .all(&self.db),
        )?;
        Ok(RpaFlow {
            id: format_flow_id(model.id),
            name: model.name,
            note: model.note,
            lifecycle: if model.lifecycle == LIFECYCLE_DELETED {
                RpaFlowLifecycle::Deleted
            } else {
                RpaFlowLifecycle::Active
            },
            definition: serde_json::from_str(&model.definition_json)?,
            default_target_profile_ids: targets
                .into_iter()
                .map(|item| format_profile_id(item.profile_id))
                .collect(),
            created_at: model.created_at,
            updated_at: model.updated_at,
            deleted_at: model.deleted_at,
            last_run_at: model.last_run_at,
        })
    }

    fn find_model(&self, flow_id: &str) -> AppResult<rpa_flow::Model> {
        let parsed = parse_flow_id(flow_id)?;
        self.db_query(rpa_flow::Entity::find_by_id(parsed).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("rpa flow not found: {flow_id}")))
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        tauri::async_runtime::block_on(future).map_err(AppError::from)
    }
}

fn validate_flow_definition(definition: &RpaFlowDefinition) -> AppResult<()> {
    require_non_empty("entryNodeId", &definition.entry_node_id)?;
    if definition.nodes.is_empty() {
        return Err(AppError::Validation("rpa flow nodes must not be empty".to_string()));
    }
    if !definition
        .nodes
        .iter()
        .any(|item| item.id == definition.entry_node_id)
    {
        return Err(AppError::Validation(
            "rpa flow entryNodeId must point to an existing node".to_string(),
        ));
    }
    Ok(())
}

fn validate_target_profile_ids(db: &DatabaseConnection, profile_ids: &[String]) -> AppResult<()> {
    for profile_id in profile_ids {
        let parsed = parse_profile_id(profile_id)?;
        let exists = tauri::async_runtime::block_on(profile::Entity::find_by_id(parsed).one(db))?;
        if exists.is_none() {
            return Err(AppError::NotFound(format!("profile not found: {profile_id}")));
        }
    }
    Ok(())
}

fn require_non_empty(field: &str, value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{field} must not be empty")));
    }
    Ok(trimmed.to_string())
}

fn trim_option(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        (!trimmed.is_empty()).then_some(trimmed)
    })
}

pub fn parse_flow_id(flow_id: &str) -> AppResult<i64> {
    flow_id
        .strip_prefix("rf_")
        .unwrap_or(flow_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid rpa flow id: {flow_id}")))
}

pub fn format_flow_id(id: i64) -> String {
    format!("rf_{id:06}")
}

pub fn parse_profile_id(profile_id: &str) -> AppResult<i64> {
    profile_id
        .strip_prefix("pf_")
        .unwrap_or(profile_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid profile id: {profile_id}")))
}

pub fn format_profile_id(id: i64) -> String {
    format!("pf_{id:06}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{
        CreateProfileGroupRequest, CreateProfileRequest, RpaFlowEdge, RpaFlowNode,
        RpaFlowNodeConfig, RpaFlowNodePosition, RpaFlowVariable, RpaRunDefaults,
    };
    use crate::services::profile_group_service::ProfileGroupService;
    use crate::services::profile_service::ProfileService;

    #[test]
    fn create_flow_persists_definition_and_default_targets() {
        let db = db::init_test_database().expect("init test db");
        let profile_service = ProfileService::from_db(db.clone());
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let service = RpaFlowService::from_db(db);

        profile_group_service
            .create_group(CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
            })
            .expect("create profile group");

        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "rpa-target".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let created = service
            .create_flow(CreateRpaFlowRequest {
                name: "Lead Collect".to_string(),
                note: Some("collect lead links".to_string()),
                definition: RpaFlowDefinition {
                    entry_node_id: "node_open".to_string(),
                    variables: vec![RpaFlowVariable {
                        key: "landingUrl".to_string(),
                        label: "Landing URL".to_string(),
                        required: true,
                        default_value: Some("https://example.com".to_string()),
                    }],
                    defaults: RpaRunDefaults {
                        concurrency_limit: 3,
                    },
                    nodes: vec![
                        RpaFlowNode {
                            id: "node_open".to_string(),
                            kind: "open_profile".to_string(),
                            position: RpaFlowNodePosition { x: 40.0, y: 80.0 },
                            config: RpaFlowNodeConfig::empty(),
                        },
                        RpaFlowNode {
                            id: "node_end".to_string(),
                            kind: "success_end".to_string(),
                            position: RpaFlowNodePosition { x: 320.0, y: 80.0 },
                            config: RpaFlowNodeConfig::empty(),
                        },
                    ],
                    edges: vec![RpaFlowEdge {
                        id: "edge_1".to_string(),
                        source: "node_open".to_string(),
                        target: "node_end".to_string(),
                        source_handle: Some("success".to_string()),
                        target_handle: None,
                    }],
                },
                default_target_profile_ids: vec![profile.id.clone()],
            })
            .expect("create flow");

        assert_eq!(created.name, "Lead Collect");
        assert_eq!(created.default_target_profile_ids, vec![profile.id.clone()]);
        assert_eq!(created.definition.nodes.len(), 2);

        let listed = service.list_flows(false).expect("list flows");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, created.id);
    }

    #[test]
    fn purge_flow_removes_deleted_flow_and_targets() {
        let db = db::init_test_database().expect("init test db");
        let profile_service = ProfileService::from_db(db.clone());
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let service = RpaFlowService::from_db(db);

        profile_group_service
            .create_group(CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
            })
            .expect("create profile group");

        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "purge-target".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let created = service
            .create_flow(CreateRpaFlowRequest {
                name: "Archive Me".to_string(),
                note: None,
                definition: RpaFlowDefinition {
                    entry_node_id: "node_open".to_string(),
                    variables: vec![],
                    defaults: RpaRunDefaults {
                        concurrency_limit: 2,
                    },
                    nodes: vec![RpaFlowNode {
                        id: "node_open".to_string(),
                        kind: "open_profile".to_string(),
                        position: RpaFlowNodePosition { x: 0.0, y: 0.0 },
                        config: RpaFlowNodeConfig::empty(),
                    }],
                    edges: vec![],
                },
                default_target_profile_ids: vec![profile.id.clone()],
            })
            .expect("create flow");

        service.delete_flow(&created.id).expect("archive flow");
        service.purge_flow(&created.id).expect("purge flow");

        assert!(service.get_flow(&created.id).expect("get flow").is_none());
        assert!(service.list_flows(true).expect("list flows").is_empty());
    }
}
