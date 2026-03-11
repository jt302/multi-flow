use std::future::Future;
use std::str::FromStr;

use chrono::{Local, TimeZone};
use cron::Schedule;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};

use crate::db::entities::{profile, rpa_flow, rpa_task, rpa_task_target};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, CreateRpaTaskRequest, RpaExecutionMode, RpaTask, RpaTaskLifecycle, RpaTaskRunType,
    RunRpaFlowRequest, UpdateRpaTaskRequest,
};
use crate::services::rpa_flow_service::{format_flow_id, format_profile_id, parse_flow_id, parse_profile_id};

const LIFECYCLE_ACTIVE: &str = "active";
const LIFECYCLE_DELETED: &str = "deleted";
const RUN_TYPE_MANUAL: &str = "manual";
const RUN_TYPE_SCHEDULED: &str = "scheduled";
const EXEC_MODE_SERIAL: &str = "serial";
const EXEC_MODE_PARALLEL: &str = "parallel";

pub struct RpaTaskService {
    db: DatabaseConnection,
}

impl RpaTaskService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_task(&self, req: CreateRpaTaskRequest) -> AppResult<RpaTask> {
        self.validate_flow_id(&req.flow_id)?;
        validate_target_profile_ids(&self.db, &req.target_profile_ids)?;

        let now = now_ts();
        let flow_id = parse_flow_id(&req.flow_id)?;
        let name = require_non_empty("name", &req.name)?;
        let run_type = to_run_type_str(&req.run_type).to_string();
        let execution_mode = to_execution_mode_str(&req.execution_mode).to_string();
        let concurrency_limit = normalize_concurrency(req.concurrency_limit.unwrap_or(3), &req.execution_mode);
        let cron_expr = normalize_cron_expr(&req.run_type, req.cron_expr)?;
        let start_at = req.start_at;
        let timezone = req
            .timezone
            .and_then(trim_non_empty)
            .unwrap_or_else(local_timezone_fallback);
        let runtime_input = req.runtime_input.unwrap_or_default();
        let runtime_input_json = serde_json::to_string(&runtime_input)?;
        let next_run_at = resolve_next_run_at(
            &req.run_type,
            true,
            cron_expr.as_deref(),
            start_at,
            now,
        )?;

        let model = rpa_task::ActiveModel {
            flow_id: Set(flow_id),
            name: Set(name),
            run_type: Set(run_type),
            execution_mode: Set(execution_mode),
            concurrency_limit: Set(concurrency_limit as i32),
            cron_expr: Set(cron_expr),
            start_at: Set(start_at),
            timezone: Set(timezone),
            enabled: Set(true),
            runtime_input_json: Set(runtime_input_json),
            lifecycle: Set(LIFECYCLE_ACTIVE.to_string()),
            deleted_at: Set(None),
            last_run_at: Set(None),
            next_run_at: Set(next_run_at),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let inserted = self.db_query(rpa_task::Entity::insert(model).exec(&self.db))?;
        self.replace_targets(inserted.last_insert_id, &req.target_profile_ids)?;
        self.get_task(&format_task_id(inserted.last_insert_id))?
            .ok_or_else(|| AppError::NotFound("rpa task missing right after create".to_string()))
    }

    pub fn update_task(&self, task_id: &str, req: UpdateRpaTaskRequest) -> AppResult<RpaTask> {
        self.validate_flow_id(&req.flow_id)?;
        validate_target_profile_ids(&self.db, &req.target_profile_ids)?;

        let existing = self.find_model(task_id)?;
        let enabled = existing.enabled;
        let mut active_model: rpa_task::ActiveModel = existing.into();
        let now = now_ts();
        let run_type = to_run_type_str(&req.run_type).to_string();
        let execution_mode = to_execution_mode_str(&req.execution_mode).to_string();
        let cron_expr = normalize_cron_expr(&req.run_type, req.cron_expr)?;
        let start_at = req.start_at;
        let next_run_at = resolve_next_run_at(
            &req.run_type,
            enabled,
            cron_expr.as_deref(),
            start_at,
            now,
        )?;

        active_model.flow_id = Set(parse_flow_id(&req.flow_id)?);
        active_model.name = Set(require_non_empty("name", &req.name)?);
        active_model.run_type = Set(run_type);
        active_model.execution_mode = Set(execution_mode);
        active_model.concurrency_limit = Set(normalize_concurrency(req.concurrency_limit.unwrap_or(3), &req.execution_mode) as i32);
        active_model.cron_expr = Set(cron_expr);
        active_model.start_at = Set(start_at);
        active_model.timezone = Set(
            req.timezone
                .and_then(trim_non_empty)
                .unwrap_or_else(local_timezone_fallback),
        );
        active_model.runtime_input_json = Set(serde_json::to_string(&req.runtime_input.unwrap_or_default())?);
        active_model.next_run_at = Set(next_run_at);
        active_model.updated_at = Set(now);

        self.db_query(active_model.update(&self.db))?;
        let task_pk = parse_task_id(task_id)?;
        self.replace_targets(task_pk, &req.target_profile_ids)?;
        self.get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))
    }

    pub fn list_tasks(&self, include_deleted: bool) -> AppResult<Vec<RpaTask>> {
        let mut query = rpa_task::Entity::find().order_by_desc(rpa_task::Column::UpdatedAt);
        if !include_deleted {
            query = query.filter(rpa_task::Column::Lifecycle.eq(LIFECYCLE_ACTIVE));
        }
        let models = self.db_query(query.all(&self.db))?;
        let mut tasks = Vec::with_capacity(models.len());
        for model in models {
            tasks.push(self.to_api_task(model)?);
        }
        Ok(tasks)
    }

    pub fn list_due_scheduled_tasks(&self, now: i64, limit: u64) -> AppResult<Vec<RpaTask>> {
        let models = self.db_query(
            rpa_task::Entity::find()
                .filter(rpa_task::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .filter(rpa_task::Column::Enabled.eq(true))
                .filter(rpa_task::Column::RunType.eq(RUN_TYPE_SCHEDULED))
                .filter(rpa_task::Column::NextRunAt.lte(now))
                .order_by_asc(rpa_task::Column::NextRunAt)
                .limit(limit)
                .all(&self.db),
        )?;
        let mut tasks = Vec::with_capacity(models.len());
        for model in models {
            tasks.push(self.to_api_task(model)?);
        }
        Ok(tasks)
    }

    pub fn skip_missed_schedules(&self, now: i64) -> AppResult<usize> {
        let models = self.db_query(
            rpa_task::Entity::find()
                .filter(rpa_task::Column::Lifecycle.eq(LIFECYCLE_ACTIVE))
                .filter(rpa_task::Column::Enabled.eq(true))
                .filter(rpa_task::Column::RunType.eq(RUN_TYPE_SCHEDULED))
                .filter(rpa_task::Column::NextRunAt.lte(now))
                .all(&self.db),
        )?;
        let mut count = 0usize;
        for model in models {
            let next_run_at = resolve_next_run_at(
                &RpaTaskRunType::Scheduled,
                true,
                model.cron_expr.as_deref(),
                model.start_at,
                now,
            )?;
            let mut active_model: rpa_task::ActiveModel = model.into();
            active_model.next_run_at = Set(next_run_at);
            active_model.updated_at = Set(now_ts());
            self.db_query(active_model.update(&self.db))?;
            count += 1;
        }
        Ok(count)
    }

    pub fn get_task(&self, task_id: &str) -> AppResult<Option<RpaTask>> {
        let parsed = parse_task_id(task_id)?;
        let model = self.db_query(rpa_task::Entity::find_by_id(parsed).one(&self.db))?;
        model.map(|item| self.to_api_task(item)).transpose()
    }

    pub fn delete_task(&self, task_id: &str) -> AppResult<RpaTask> {
        let existing = self.find_model(task_id)?;
        if existing.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!("rpa task already deleted: {task_id}")));
        }
        let mut active_model: rpa_task::ActiveModel = existing.into();
        let now = now_ts();
        active_model.lifecycle = Set(LIFECYCLE_DELETED.to_string());
        active_model.enabled = Set(false);
        active_model.next_run_at = Set(None);
        active_model.deleted_at = Set(Some(now));
        active_model.updated_at = Set(now);
        self.db_query(active_model.update(&self.db))?;
        self.get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))
    }

    pub fn toggle_enabled(&self, task_id: &str, enabled: bool) -> AppResult<RpaTask> {
        let existing = self.find_model(task_id)?;
        if existing.lifecycle == LIFECYCLE_DELETED {
            return Err(AppError::Conflict(format!("rpa task already deleted: {task_id}")));
        }
        let run_type = parse_run_type(&existing.run_type);
        let cron_expr = existing.cron_expr.clone();
        let start_at = existing.start_at;
        let mut active_model: rpa_task::ActiveModel = existing.into();
        let next_run_at = resolve_next_run_at(
            &run_type,
            enabled,
            cron_expr.as_deref(),
            start_at,
            now_ts(),
        )?;

        active_model.enabled = Set(enabled);
        active_model.next_run_at = Set(next_run_at);
        active_model.updated_at = Set(now_ts());
        self.db_query(active_model.update(&self.db))?;

        self.get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))
    }

    pub fn build_run_request(&self, task_id: &str) -> AppResult<(RpaTask, RunRpaFlowRequest)> {
        let task = self
            .get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))?;
        if task.lifecycle != RpaTaskLifecycle::Active {
            return Err(AppError::Conflict(format!("rpa task is deleted: {task_id}")));
        }
        if !task.enabled {
            return Err(AppError::Conflict(format!("rpa task is disabled: {task_id}")));
        }
        let payload = RunRpaFlowRequest {
            flow_id: task.flow_id.clone(),
            target_profile_ids: task.target_profile_ids.clone(),
            concurrency_limit: Some(task.concurrency_limit),
            runtime_input: task.runtime_input.clone(),
            trigger_source: Some("task_manual".to_string()),
            task_id: Some(task.id.clone()),
            task_name: Some(task.name.clone()),
        };
        Ok((task, payload))
    }

    pub fn build_schedule_run_request(&self, task_id: &str) -> AppResult<(RpaTask, RunRpaFlowRequest)> {
        let task = self
            .get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))?;
        let payload = RunRpaFlowRequest {
            flow_id: task.flow_id.clone(),
            target_profile_ids: task.target_profile_ids.clone(),
            concurrency_limit: Some(task.concurrency_limit),
            runtime_input: task.runtime_input.clone(),
            trigger_source: Some("task_schedule".to_string()),
            task_id: Some(task.id.clone()),
            task_name: Some(task.name.clone()),
        };
        Ok((task, payload))
    }

    pub fn touch_after_run(&self, task_id: &str, trigger_ts: i64) -> AppResult<RpaTask> {
        let existing = self.find_model(task_id)?;
        let mut active_model: rpa_task::ActiveModel = existing.clone().into();
        let run_type = parse_run_type(&existing.run_type);
        let next_run_at = resolve_next_run_at(
            &run_type,
            existing.enabled,
            existing.cron_expr.as_deref(),
            existing.start_at,
            trigger_ts,
        )?;
        active_model.last_run_at = Set(Some(trigger_ts));
        active_model.next_run_at = Set(next_run_at);
        active_model.updated_at = Set(now_ts());
        self.db_query(active_model.update(&self.db))?;
        self.get_task(task_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))
    }

    fn validate_flow_id(&self, flow_id: &str) -> AppResult<()> {
        let parsed = parse_flow_id(flow_id)?;
        let model = self.db_query(rpa_flow::Entity::find_by_id(parsed).one(&self.db))?;
        let Some(flow) = model else {
            return Err(AppError::NotFound(format!("rpa flow not found: {flow_id}")));
        };
        if flow.lifecycle != LIFECYCLE_ACTIVE {
            return Err(AppError::Conflict(format!("rpa flow is not active: {flow_id}")));
        }
        Ok(())
    }

    fn replace_targets(&self, task_pk: i64, profile_ids: &[String]) -> AppResult<()> {
        let now = now_ts();
        self.db_query(
            rpa_task_target::Entity::delete_many()
                .filter(rpa_task_target::Column::TaskId.eq(task_pk))
                .exec(&self.db),
        )?;

        for (index, profile_id) in profile_ids.iter().enumerate() {
            let model = rpa_task_target::ActiveModel {
                task_id: Set(task_pk),
                profile_id: Set(parse_profile_id(profile_id)?),
                order_index: Set(index as i32),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            self.db_query(rpa_task_target::Entity::insert(model).exec(&self.db))?;
        }
        Ok(())
    }

    fn to_api_task(&self, model: rpa_task::Model) -> AppResult<RpaTask> {
        let flow = self
            .db_query(rpa_flow::Entity::find_by_id(model.flow_id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("rpa flow missing for task: {}", model.id)))?;

        let targets = self.db_query(
            rpa_task_target::Entity::find()
                .filter(rpa_task_target::Column::TaskId.eq(model.id))
                .order_by_asc(rpa_task_target::Column::OrderIndex)
                .all(&self.db),
        )?;

        Ok(RpaTask {
            id: format_task_id(model.id),
            flow_id: format_flow_id(model.flow_id),
            flow_name: flow.name,
            name: model.name,
            run_type: parse_run_type(&model.run_type),
            execution_mode: parse_execution_mode(&model.execution_mode),
            concurrency_limit: model.concurrency_limit.max(1) as u32,
            cron_expr: model.cron_expr,
            start_at: model.start_at,
            timezone: model.timezone,
            enabled: model.enabled,
            runtime_input: serde_json::from_str(&model.runtime_input_json)?,
            target_profile_ids: targets
                .into_iter()
                .map(|item| format_profile_id(item.profile_id))
                .collect(),
            lifecycle: if model.lifecycle == LIFECYCLE_DELETED {
                RpaTaskLifecycle::Deleted
            } else {
                RpaTaskLifecycle::Active
            },
            deleted_at: model.deleted_at,
            last_run_at: model.last_run_at,
            next_run_at: model.next_run_at,
            created_at: model.created_at,
            updated_at: model.updated_at,
        })
    }

    fn find_model(&self, task_id: &str) -> AppResult<rpa_task::Model> {
        let parsed = parse_task_id(task_id)?;
        self.db_query(rpa_task::Entity::find_by_id(parsed).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("rpa task not found: {task_id}")))
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        tauri::async_runtime::block_on(future).map_err(AppError::from)
    }
}

fn compute_next_run_ts(cron_expr: &str, after_ts: i64) -> AppResult<Option<i64>> {
    let schedule = Schedule::from_str(cron_expr)
        .map_err(|err| AppError::Validation(format!("invalid cron expression: {err}")))?;
    let base = Local
        .timestamp_opt(after_ts.max(0), 0)
        .single()
        .unwrap_or_else(Local::now);
    Ok(schedule.after(&base).next().map(|dt| dt.timestamp()))
}

fn resolve_next_run_at(
    run_type: &RpaTaskRunType,
    enabled: bool,
    cron_expr: Option<&str>,
    start_at: Option<i64>,
    reference_ts: i64,
) -> AppResult<Option<i64>> {
    if !enabled || *run_type == RpaTaskRunType::Manual {
        return Ok(None);
    }

    let cron_expr = cron_expr
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::Validation("cronExpr must not be empty for scheduled tasks".to_string()))?;

    let anchor = start_at.unwrap_or(reference_ts).max(reference_ts);
    compute_next_run_ts(cron_expr, anchor.saturating_sub(1))
}

fn normalize_cron_expr(run_type: &RpaTaskRunType, cron_expr: Option<String>) -> AppResult<Option<String>> {
    match run_type {
        RpaTaskRunType::Manual => Ok(None),
        RpaTaskRunType::Scheduled => {
            let Some(expr) = trim_option(cron_expr) else {
                return Err(AppError::Validation(
                    "cronExpr is required for scheduled task".to_string(),
                ));
            };
            // validate once to fail fast
            compute_next_run_ts(&expr, now_ts())?;
            Ok(Some(expr))
        }
    }
}

fn normalize_concurrency(limit: u32, execution_mode: &RpaExecutionMode) -> u32 {
    match execution_mode {
        RpaExecutionMode::Serial => 1,
        RpaExecutionMode::Parallel => limit.clamp(1, 5),
    }
}

fn to_run_type_str(run_type: &RpaTaskRunType) -> &'static str {
    match run_type {
        RpaTaskRunType::Manual => RUN_TYPE_MANUAL,
        RpaTaskRunType::Scheduled => RUN_TYPE_SCHEDULED,
    }
}

fn parse_run_type(value: &str) -> RpaTaskRunType {
    match value {
        RUN_TYPE_SCHEDULED => RpaTaskRunType::Scheduled,
        _ => RpaTaskRunType::Manual,
    }
}

fn to_execution_mode_str(mode: &RpaExecutionMode) -> &'static str {
    match mode {
        RpaExecutionMode::Serial => EXEC_MODE_SERIAL,
        RpaExecutionMode::Parallel => EXEC_MODE_PARALLEL,
    }
}

fn parse_execution_mode(value: &str) -> RpaExecutionMode {
    match value {
        EXEC_MODE_SERIAL => RpaExecutionMode::Serial,
        _ => RpaExecutionMode::Parallel,
    }
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
    value.and_then(trim_non_empty)
}

fn trim_non_empty(value: String) -> Option<String> {
    let trimmed = value.trim().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn local_timezone_fallback() -> String {
    Local::now().offset().to_string()
}

pub fn parse_task_id(task_id: &str) -> AppResult<i64> {
    task_id
        .strip_prefix("rt_")
        .unwrap_or(task_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid rpa task id: {task_id}")))
}

pub fn format_task_id(id: i64) -> String {
    format!("rt_{id:06}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{
        CreateProfileGroupRequest, CreateProfileRequest, CreateRpaFlowRequest, RpaFlowDefinition,
        RpaFlowNode, RpaFlowNodeConfig, RpaFlowNodePosition, RpaRunDefaults,
    };
    use crate::services::profile_group_service::ProfileGroupService;
    use crate::services::profile_service::ProfileService;
    use crate::services::rpa_flow_service::RpaFlowService;

    fn setup_flow_context() -> (RpaTaskService, String, String) {
        let db = db::init_test_database().expect("init test db");
        let profile_service = ProfileService::from_db(db.clone());
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let flow_service = RpaFlowService::from_db(db.clone());
        let task_service = RpaTaskService::from_db(db);

        profile_group_service
            .create_group(CreateProfileGroupRequest {
                name: "growth".to_string(),
                note: None,
            })
            .expect("create group");
        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "target-a".to_string(),
                group: Some("growth".to_string()),
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let flow = flow_service
            .create_flow(CreateRpaFlowRequest {
                name: "task-flow".to_string(),
                note: None,
                definition: RpaFlowDefinition {
                    entry_node_id: "node_open".to_string(),
                    variables: vec![],
                    defaults: RpaRunDefaults {
                        concurrency_limit: 3,
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

        (task_service, flow.id, profile.id)
    }

    #[test]
    fn create_scheduled_task_persists_targets_and_next_run() {
        let (service, flow_id, profile_id) = setup_flow_context();

        let created = service
            .create_task(CreateRpaTaskRequest {
                flow_id,
                name: "daily task".to_string(),
                run_type: RpaTaskRunType::Scheduled,
                execution_mode: RpaExecutionMode::Parallel,
                concurrency_limit: Some(2),
                cron_expr: Some("0/5 * * * * * *".to_string()),
                start_at: Some(now_ts()),
                timezone: Some("Asia/Shanghai".to_string()),
                target_profile_ids: vec![profile_id.clone()],
                runtime_input: None,
            })
            .expect("create task");

        assert_eq!(created.flow_name, "task-flow");
        assert_eq!(created.target_profile_ids, vec![profile_id]);
        assert!(created.next_run_at.is_some());
    }

    #[test]
    fn toggle_disable_clears_next_run_at() {
        let (service, flow_id, profile_id) = setup_flow_context();

        let created = service
            .create_task(CreateRpaTaskRequest {
                flow_id,
                name: "cron task".to_string(),
                run_type: RpaTaskRunType::Scheduled,
                execution_mode: RpaExecutionMode::Parallel,
                concurrency_limit: Some(3),
                cron_expr: Some("0/10 * * * * * *".to_string()),
                start_at: Some(now_ts()),
                timezone: None,
                target_profile_ids: vec![profile_id],
                runtime_input: None,
            })
            .expect("create task");

        let disabled = service
            .toggle_enabled(&created.id, false)
            .expect("disable task");

        assert!(!disabled.enabled);
        assert_eq!(disabled.next_run_at, None);
    }

    #[test]
    fn skip_missed_schedules_moves_next_run_to_future_without_execution() {
        let (service, flow_id, profile_id) = setup_flow_context();

        let created = service
            .create_task(CreateRpaTaskRequest {
                flow_id,
                name: "skip-missed".to_string(),
                run_type: RpaTaskRunType::Scheduled,
                execution_mode: RpaExecutionMode::Parallel,
                concurrency_limit: Some(2),
                cron_expr: Some("0/30 * * * * * *".to_string()),
                start_at: Some(now_ts()),
                timezone: None,
                target_profile_ids: vec![profile_id],
                runtime_input: None,
            })
            .expect("create task");

        let future_now = now_ts() + 7200;
        let affected = service
            .skip_missed_schedules(future_now)
            .expect("skip missed schedules");
        assert_eq!(affected, 1);

        let refreshed = service
            .get_task(&created.id)
            .expect("get task")
            .expect("task exists");
        assert!(refreshed.next_run_at.unwrap_or_default() > future_now);
        assert_eq!(refreshed.last_run_at, None);
    }
}
