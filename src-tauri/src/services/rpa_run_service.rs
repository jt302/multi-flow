use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};

use crate::db::entities::{rpa_run, rpa_run_instance, rpa_run_step};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, RpaArtifactIndex, RpaFlow, RpaRun, RpaRunDetails, RpaRunInstance,
    RpaRunInstanceStatus, RpaRunStatus, RpaRunStep, RpaRunStepStatus, RunRpaFlowRequest,
};
use crate::services::rpa_flow_service::{format_profile_id, parse_profile_id};

pub struct RpaRunService {
    db: DatabaseConnection,
}

impl RpaRunService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn create_run(&self, flow: &RpaFlow, req: RunRpaFlowRequest) -> AppResult<RpaRun> {
        if req.target_profile_ids.is_empty() {
            return Err(AppError::Validation(
                "targetProfileIds must not be empty".to_string(),
            ));
        }
        let now = now_ts();
        let concurrency_limit = normalize_concurrency(req.concurrency_limit.unwrap_or(
            flow.definition.defaults.concurrency_limit.max(1),
        ));
        let definition_snapshot_json = serde_json::to_string(&flow.definition)?;
        let runtime_input_json = serde_json::to_string(&req.runtime_input)?;
        let model = rpa_run::ActiveModel {
            flow_id: Set(parse_flow_id(&flow.id)?),
            flow_name: Set(flow.name.clone()),
            trigger_source: Set("manual".to_string()),
            status: Set("queued".to_string()),
            total_instances: Set(req.target_profile_ids.len() as i32),
            success_count: Set(0),
            failed_count: Set(0),
            cancelled_count: Set(0),
            concurrency_limit: Set(concurrency_limit as i32),
            definition_snapshot_json: Set(definition_snapshot_json),
            runtime_input_json: Set(runtime_input_json),
            started_at: Set(None),
            finished_at: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let inserted = self.db_query(rpa_run::Entity::insert(model).exec(&self.db))?;
        for profile_id in &req.target_profile_ids {
            let context = build_initial_context(&flow, &req.runtime_input);
            let instance = rpa_run_instance::ActiveModel {
                run_id: Set(inserted.last_insert_id),
                profile_id: Set(parse_profile_id(profile_id)?),
                status: Set("queued".to_string()),
                current_node_id: Set(Some(flow.definition.entry_node_id.clone())),
                context_json: Set(serde_json::to_string(&context)?),
                artifact_index_json: Set(serde_json::to_string(&RpaArtifactIndex::default())?),
                error_message: Set(None),
                started_at: Set(None),
                finished_at: Set(None),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            self.db_query(rpa_run_instance::Entity::insert(instance).exec(&self.db))?;
        }
        self.get_run(&format_run_id(inserted.last_insert_id))?
            .ok_or_else(|| AppError::NotFound("rpa run missing right after create".to_string()))
    }

    pub fn list_runs(&self, limit: Option<u64>) -> AppResult<Vec<RpaRun>> {
        let mut query = rpa_run::Entity::find().order_by_desc(rpa_run::Column::CreatedAt);
        if let Some(limit) = limit {
            query = query.limit(limit);
        }
        let models = self.db_query(query.all(&self.db))?;
        models.into_iter().map(to_api_run).collect()
    }

    pub fn get_run(&self, run_id: &str) -> AppResult<Option<RpaRun>> {
        let id = parse_run_id(run_id)?;
        self.db_query(rpa_run::Entity::find_by_id(id).one(&self.db))?
            .map(to_api_run)
            .transpose()
    }

    pub fn get_run_details(&self, run_id: &str) -> AppResult<Option<RpaRunDetails>> {
        let Some(run) = self.get_run(run_id)? else {
            return Ok(None);
        };
        let instances = self.list_instances_by_run(run_id)?;
        Ok(Some(RpaRunDetails { run, instances }))
    }

    pub fn list_instances_by_run(&self, run_id: &str) -> AppResult<Vec<RpaRunInstance>> {
        let id = parse_run_id(run_id)?;
        let models = self.db_query(
            rpa_run_instance::Entity::find()
                .filter(rpa_run_instance::Column::RunId.eq(id))
                .order_by_asc(rpa_run_instance::Column::CreatedAt)
                .all(&self.db),
        )?;
        models.into_iter().map(to_api_instance).collect()
    }

    pub fn list_run_steps(&self, instance_id: &str) -> AppResult<Vec<RpaRunStep>> {
        let id = parse_instance_id(instance_id)?;
        let models = self.db_query(
            rpa_run_step::Entity::find()
                .filter(rpa_run_step::Column::RunInstanceId.eq(id))
                .order_by_asc(rpa_run_step::Column::StartedAt)
                .all(&self.db),
        )?;
        models.into_iter().map(to_api_step).collect()
    }

    pub fn list_runnable_instances(&self, run_id: &str) -> AppResult<Vec<RpaRunInstance>> {
        let id = parse_run_id(run_id)?;
        let models = self.db_query(
            rpa_run_instance::Entity::find()
                .filter(rpa_run_instance::Column::RunId.eq(id))
                .filter(rpa_run_instance::Column::Status.eq("queued"))
                .order_by_asc(rpa_run_instance::Column::CreatedAt)
                .all(&self.db),
        )?;
        models.into_iter().map(to_api_instance).collect()
    }

    pub fn mark_run_started(&self, run_id: &str) -> AppResult<RpaRun> {
        self.update_run_status(run_id, RpaRunStatus::Running, Some(now_ts()))
    }

    pub fn update_run_aggregate_status(&self, run_id: &str) -> AppResult<RpaRun> {
        let instances = self.list_instances_by_run(run_id)?;
        let success_count = instances
            .iter()
            .filter(|item| item.status == RpaRunInstanceStatus::Success)
            .count();
        let failed_count = instances
            .iter()
            .filter(|item| {
                matches!(
                    item.status,
                    RpaRunInstanceStatus::Failed | RpaRunInstanceStatus::Interrupted
                )
            })
            .count();
        let cancelled_count = instances
            .iter()
            .filter(|item| item.status == RpaRunInstanceStatus::Cancelled)
            .count();
        let any_running = instances.iter().any(|item| {
            matches!(
                item.status,
                RpaRunInstanceStatus::Queued
                    | RpaRunInstanceStatus::Running
                    | RpaRunInstanceStatus::NeedsManual
            )
        });
        let status = if any_running {
            RpaRunStatus::Running
        } else if success_count == instances.len() {
            RpaRunStatus::Success
        } else if success_count > 0 {
            RpaRunStatus::PartialSuccess
        } else if cancelled_count == instances.len() {
            RpaRunStatus::Cancelled
        } else {
            RpaRunStatus::Failed
        };
        let existing = self.find_run_model(run_id)?;
        let mut active: rpa_run::ActiveModel = existing.into();
        active.status = Set(to_run_status_str(&status).to_string());
        active.success_count = Set(success_count as i32);
        active.failed_count = Set(failed_count as i32);
        active.cancelled_count = Set(cancelled_count as i32);
        active.updated_at = Set(now_ts());
        if !any_running {
            active.finished_at = Set(Some(now_ts()));
        }
        self.db_query(active.update(&self.db))?;
        self.get_run(run_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa run not found: {run_id}")))
    }

    pub fn cancel_run(&self, run_id: &str) -> AppResult<RpaRun> {
        let run_pk = parse_run_id(run_id)?;
        let instances = self.db_query(
            rpa_run_instance::Entity::find()
                .filter(rpa_run_instance::Column::RunId.eq(run_pk))
                .all(&self.db),
        )?;
        for instance in instances {
            let mut active: rpa_run_instance::ActiveModel = instance.into();
            if matches!(
                active.status.clone().unwrap().as_str(),
                "success" | "failed" | "cancelled"
            ) {
                continue;
            }
            active.status = Set("cancelled".to_string());
            active.finished_at = Set(Some(now_ts()));
            active.updated_at = Set(now_ts());
            self.db_query(active.update(&self.db))?;
        }
        self.update_run_aggregate_status(run_id)
    }

    pub fn cancel_instance(&self, instance_id: &str) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.status = Set("cancelled".to_string());
        active.finished_at = Set(Some(now_ts()));
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        let instance = self.get_instance(instance_id)?;
        self.update_run_aggregate_status(&instance.run_id)?;
        Ok(instance)
    }

    pub fn get_instance(&self, instance_id: &str) -> AppResult<RpaRunInstance> {
        let model = self.find_instance_model(instance_id)?;
        to_api_instance(model)
    }

    pub fn mark_instance_running(
        &self,
        instance_id: &str,
        current_node_id: Option<String>,
    ) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.status = Set("running".to_string());
        active.current_node_id = Set(current_node_id);
        let now = now_ts();
        if active.started_at.clone().unwrap().is_none() {
            active.started_at = Set(Some(now));
        }
        active.updated_at = Set(now);
        self.db_query(active.update(&self.db))?;
        self.get_instance(instance_id)
    }

    pub fn mark_instance_manual(
        &self,
        instance_id: &str,
        current_node_id: String,
    ) -> AppResult<RpaRunInstance> {
        self.update_instance_terminal_state(
            instance_id,
            RpaRunInstanceStatus::NeedsManual,
            Some(current_node_id),
            None,
        )
    }

    pub fn mark_instance_success(
        &self,
        instance_id: &str,
        current_node_id: Option<String>,
        context: serde_json::Map<String, serde_json::Value>,
    ) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.status = Set("success".to_string());
        active.current_node_id = Set(current_node_id);
        active.context_json = Set(serde_json::to_string(&context)?);
        active.finished_at = Set(Some(now_ts()));
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        let instance = self.get_instance(instance_id)?;
        self.update_run_aggregate_status(&instance.run_id)?;
        Ok(instance)
    }

    pub fn mark_instance_failed(
        &self,
        instance_id: &str,
        current_node_id: Option<String>,
        context: serde_json::Map<String, serde_json::Value>,
        message: String,
    ) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.status = Set("failed".to_string());
        active.current_node_id = Set(current_node_id);
        active.context_json = Set(serde_json::to_string(&context)?);
        active.error_message = Set(Some(message));
        active.finished_at = Set(Some(now_ts()));
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        let instance = self.get_instance(instance_id)?;
        self.update_run_aggregate_status(&instance.run_id)?;
        Ok(instance)
    }

    pub fn mark_incomplete_runs_interrupted(&self) -> AppResult<usize> {
        let models = self.db_query(
            rpa_run_instance::Entity::find()
                .filter(rpa_run_instance::Column::Status.is_in(["queued", "running"]))
                .all(&self.db),
        )?;
        let mut count = 0usize;
        for model in models {
            let mut active: rpa_run_instance::ActiveModel = model.clone().into();
            active.status = Set("interrupted".to_string());
            active.finished_at = Set(Some(now_ts()));
            active.updated_at = Set(now_ts());
            self.db_query(active.update(&self.db))?;
            count += 1;
        }
        Ok(count)
    }

    pub fn append_step(&self, step: NewRpaRunStep) -> AppResult<RpaRunStep> {
        let model = rpa_run_step::ActiveModel {
            run_instance_id: Set(parse_instance_id(&step.run_instance_id)?),
            node_id: Set(step.node_id),
            node_kind: Set(step.node_kind),
            status: Set(to_step_status_str(&step.status).to_string()),
            attempt: Set(step.attempt as i32),
            input_snapshot_json: Set(serde_json::to_string(&step.input_snapshot)?),
            output_snapshot_json: Set(serde_json::to_string(&step.output_snapshot)?),
            error_message: Set(step.error_message),
            artifact_index_json: Set(serde_json::to_string(&step.artifacts)?),
            started_at: Set(step.started_at),
            finished_at: Set(step.finished_at),
            ..Default::default()
        };
        let inserted = self.db_query(rpa_run_step::Entity::insert(model).exec(&self.db))?;
        let created = self.db_query(rpa_run_step::Entity::find_by_id(inserted.last_insert_id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound("rpa step missing right after create".to_string()))?;
        let api = to_api_step(created)?;
        self.update_instance_artifacts(&step.run_instance_id, api.artifacts.clone())?;
        Ok(api)
    }

    pub fn update_instance_context(
        &self,
        instance_id: &str,
        current_node_id: Option<String>,
        context: serde_json::Map<String, serde_json::Value>,
    ) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.current_node_id = Set(current_node_id);
        active.context_json = Set(serde_json::to_string(&context)?);
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        self.get_instance(instance_id)
    }

    fn update_instance_artifacts(
        &self,
        instance_id: &str,
        artifacts: RpaArtifactIndex,
    ) -> AppResult<()> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        let mut current: RpaArtifactIndex = serde_json::from_str(
            active.artifact_index_json.clone().unwrap().as_str(),
        )?;
        if artifacts.screenshot_path.is_some() {
            current.screenshot_path = artifacts.screenshot_path;
        }
        if artifacts.html_path.is_some() {
            current.html_path = artifacts.html_path;
        }
        if artifacts.output_path.is_some() {
            current.output_path = artifacts.output_path;
        }
        active.artifact_index_json = Set(serde_json::to_string(&current)?);
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        Ok(())
    }

    fn update_run_status(
        &self,
        run_id: &str,
        status: RpaRunStatus,
        started_at: Option<i64>,
    ) -> AppResult<RpaRun> {
        let existing = self.find_run_model(run_id)?;
        let mut active: rpa_run::ActiveModel = existing.into();
        active.status = Set(to_run_status_str(&status).to_string());
        if let Some(started_at) = started_at {
            active.started_at = Set(Some(started_at));
        }
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        self.get_run(run_id)?
            .ok_or_else(|| AppError::NotFound(format!("rpa run not found: {run_id}")))
    }

    fn update_instance_terminal_state(
        &self,
        instance_id: &str,
        status: RpaRunInstanceStatus,
        current_node_id: Option<String>,
        error_message: Option<String>,
    ) -> AppResult<RpaRunInstance> {
        let existing = self.find_instance_model(instance_id)?;
        let mut active: rpa_run_instance::ActiveModel = existing.into();
        active.status = Set(to_instance_status_str(&status).to_string());
        active.current_node_id = Set(current_node_id);
        active.error_message = Set(error_message);
        active.updated_at = Set(now_ts());
        if matches!(
            status,
            RpaRunInstanceStatus::Success
                | RpaRunInstanceStatus::Failed
                | RpaRunInstanceStatus::Cancelled
                | RpaRunInstanceStatus::Interrupted
        ) {
            active.finished_at = Set(Some(now_ts()));
        }
        self.db_query(active.update(&self.db))?;
        self.get_instance(instance_id)
    }

    fn find_run_model(&self, run_id: &str) -> AppResult<rpa_run::Model> {
        let id = parse_run_id(run_id)?;
        self.db_query(rpa_run::Entity::find_by_id(id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("rpa run not found: {run_id}")))
    }

    fn find_instance_model(&self, instance_id: &str) -> AppResult<rpa_run_instance::Model> {
        let id = parse_instance_id(instance_id)?;
        self.db_query(rpa_run_instance::Entity::find_by_id(id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("rpa run instance not found: {instance_id}")))
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        tauri::async_runtime::block_on(future).map_err(AppError::from)
    }
}

#[derive(Debug, Clone)]
pub struct NewRpaRunStep {
    pub run_instance_id: String,
    pub node_id: String,
    pub node_kind: String,
    pub status: RpaRunStepStatus,
    pub attempt: u32,
    pub input_snapshot: serde_json::Map<String, serde_json::Value>,
    pub output_snapshot: serde_json::Map<String, serde_json::Value>,
    pub error_message: Option<String>,
    pub artifacts: RpaArtifactIndex,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

fn build_initial_context(
    flow: &RpaFlow,
    runtime_input: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    let mut context = serde_json::Map::new();
    for variable in &flow.definition.variables {
        if let Some(value) = runtime_input.get(&variable.key) {
            context.insert(variable.key.clone(), value.clone());
            continue;
        }
        if let Some(default_value) = &variable.default_value {
            context.insert(
                variable.key.clone(),
                serde_json::Value::String(default_value.clone()),
            );
        }
    }
    for (key, value) in runtime_input {
        context.insert(key.clone(), value.clone());
    }
    context
}

fn to_api_run(model: rpa_run::Model) -> AppResult<RpaRun> {
    Ok(RpaRun {
        id: format_run_id(model.id),
        flow_id: format_flow_id(model.flow_id),
        flow_name: model.flow_name,
        trigger_source: model.trigger_source,
        status: parse_run_status(&model.status),
        total_instances: model.total_instances.max(0) as usize,
        success_count: model.success_count.max(0) as usize,
        failed_count: model.failed_count.max(0) as usize,
        cancelled_count: model.cancelled_count.max(0) as usize,
        concurrency_limit: model.concurrency_limit.max(1) as u32,
        definition_snapshot: serde_json::from_str(&model.definition_snapshot_json)?,
        runtime_input: serde_json::from_str(&model.runtime_input_json)?,
        started_at: model.started_at,
        finished_at: model.finished_at,
        created_at: model.created_at,
        updated_at: model.updated_at,
    })
}

fn to_api_instance(model: rpa_run_instance::Model) -> AppResult<RpaRunInstance> {
    Ok(RpaRunInstance {
        id: format_instance_id(model.id),
        run_id: format_run_id(model.run_id),
        profile_id: format_profile_id(model.profile_id),
        status: parse_instance_status(&model.status),
        current_node_id: model.current_node_id,
        context: serde_json::from_str(&model.context_json)?,
        artifact_index: serde_json::from_str(&model.artifact_index_json)?,
        error_message: model.error_message,
        started_at: model.started_at,
        finished_at: model.finished_at,
        created_at: model.created_at,
        updated_at: model.updated_at,
    })
}

fn to_api_step(model: rpa_run_step::Model) -> AppResult<RpaRunStep> {
    Ok(RpaRunStep {
        id: format_step_id(model.id),
        run_instance_id: format_instance_id(model.run_instance_id),
        node_id: model.node_id,
        node_kind: model.node_kind,
        status: parse_step_status(&model.status),
        attempt: model.attempt.max(0) as u32,
        input_snapshot: serde_json::from_str(&model.input_snapshot_json)?,
        output_snapshot: serde_json::from_str(&model.output_snapshot_json)?,
        error_message: model.error_message,
        artifacts: serde_json::from_str(&model.artifact_index_json)?,
        started_at: model.started_at,
        finished_at: model.finished_at,
    })
}

fn normalize_concurrency(limit: u32) -> u32 {
    limit.clamp(1, 5)
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

pub fn parse_run_id(run_id: &str) -> AppResult<i64> {
    run_id
        .strip_prefix("rr_")
        .unwrap_or(run_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid rpa run id: {run_id}")))
}

pub fn format_run_id(id: i64) -> String {
    format!("rr_{id:06}")
}

pub fn parse_instance_id(instance_id: &str) -> AppResult<i64> {
    instance_id
        .strip_prefix("ri_")
        .unwrap_or(instance_id)
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid rpa run instance id: {instance_id}")))
}

pub fn format_instance_id(id: i64) -> String {
    format!("ri_{id:06}")
}

pub fn format_step_id(id: i64) -> String {
    format!("rs_{id:06}")
}

fn parse_run_status(value: &str) -> RpaRunStatus {
    match value {
        "running" => RpaRunStatus::Running,
        "partial_success" => RpaRunStatus::PartialSuccess,
        "success" => RpaRunStatus::Success,
        "failed" => RpaRunStatus::Failed,
        "cancelled" => RpaRunStatus::Cancelled,
        _ => RpaRunStatus::Queued,
    }
}

fn parse_instance_status(value: &str) -> RpaRunInstanceStatus {
    match value {
        "running" => RpaRunInstanceStatus::Running,
        "needs_manual" => RpaRunInstanceStatus::NeedsManual,
        "success" => RpaRunInstanceStatus::Success,
        "failed" => RpaRunInstanceStatus::Failed,
        "cancelled" => RpaRunInstanceStatus::Cancelled,
        "interrupted" => RpaRunInstanceStatus::Interrupted,
        _ => RpaRunInstanceStatus::Queued,
    }
}

fn parse_step_status(value: &str) -> RpaRunStepStatus {
    match value {
        "success" => RpaRunStepStatus::Success,
        "failed" => RpaRunStepStatus::Failed,
        "skipped" => RpaRunStepStatus::Skipped,
        _ => RpaRunStepStatus::Running,
    }
}

pub fn to_run_status_str(status: &RpaRunStatus) -> &'static str {
    match status {
        RpaRunStatus::Queued => "queued",
        RpaRunStatus::Running => "running",
        RpaRunStatus::PartialSuccess => "partial_success",
        RpaRunStatus::Success => "success",
        RpaRunStatus::Failed => "failed",
        RpaRunStatus::Cancelled => "cancelled",
    }
}

fn to_instance_status_str(status: &RpaRunInstanceStatus) -> &'static str {
    match status {
        RpaRunInstanceStatus::Queued => "queued",
        RpaRunInstanceStatus::Running => "running",
        RpaRunInstanceStatus::NeedsManual => "needs_manual",
        RpaRunInstanceStatus::Success => "success",
        RpaRunInstanceStatus::Failed => "failed",
        RpaRunInstanceStatus::Cancelled => "cancelled",
        RpaRunInstanceStatus::Interrupted => "interrupted",
    }
}

fn to_step_status_str(status: &RpaRunStepStatus) -> &'static str {
    match status {
        RpaRunStepStatus::Running => "running",
        RpaRunStepStatus::Success => "success",
        RpaRunStepStatus::Failed => "failed",
        RpaRunStepStatus::Skipped => "skipped",
    }
}
