use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use crate::db::entities::{automation_run, automation_script};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, AutomationRun, AutomationScript, CreateAutomationScriptRequest, ScriptStep,
    StepResult,
};

#[derive(Clone)]
pub struct AutomationService {
    db: DatabaseConnection,
}

impl AutomationService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn list_scripts(&self) -> AppResult<Vec<AutomationScript>> {
        let items = self.db_query(
            automation_script::Entity::find()
                .order_by_asc(automation_script::Column::CreatedAt)
                .all(&self.db),
        )?;
        items.into_iter().map(to_api_script).collect()
    }

    pub fn get_script(&self, script_id: &str) -> AppResult<AutomationScript> {
        let model = self.find_script_model(script_id)?;
        to_api_script(model)
    }

    pub fn create_script(
        &self,
        req: CreateAutomationScriptRequest,
    ) -> AppResult<AutomationScript> {
        let name = req.name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".to_string()));
        }
        let steps_json = serde_json::to_string(&req.steps)
            .map_err(|e| AppError::Validation(format!("invalid steps: {e}")))?;
        let now = now_ts();
        let id = uuid::Uuid::new_v4().to_string();
        let model = automation_script::ActiveModel {
            id: Set(id),
            name: Set(name),
            description: Set(req.description.and_then(|d| {
                let d = d.trim().to_string();
                if d.is_empty() { None } else { Some(d) }
            })),
            steps_json: Set(steps_json),
            created_at: Set(now),
            updated_at: Set(now),
            canvas_positions_json: Set(None),
        };
        let inserted = self.db_query(model.insert(&self.db))?;
        to_api_script(inserted)
    }

    pub fn update_script(
        &self,
        script_id: &str,
        req: CreateAutomationScriptRequest,
    ) -> AppResult<AutomationScript> {
        let existing = self.find_script_model(script_id)?;
        let name = req.name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".to_string()));
        }
        let steps_json = serde_json::to_string(&req.steps)
            .map_err(|e| AppError::Validation(format!("invalid steps: {e}")))?;
        let mut active: automation_script::ActiveModel = existing.into();
        active.name = Set(name);
        active.description = Set(req.description.and_then(|d| {
            let d = d.trim().to_string();
            if d.is_empty() { None } else { Some(d) }
        }));
        active.steps_json = Set(steps_json);
        active.updated_at = Set(now_ts());
        let updated = self.db_query(active.update(&self.db))?;
        to_api_script(updated)
    }

    pub fn delete_script(&self, script_id: &str) -> AppResult<()> {
        let model = self.find_script_model(script_id)?;
        let active: automation_script::ActiveModel = model.into();
        self.db_query(active.delete(&self.db))?;
        Ok(())
    }

    pub fn list_runs(&self, script_id: &str) -> AppResult<Vec<AutomationRun>> {
        let items = self.db_query(
            automation_run::Entity::find()
                .filter(automation_run::Column::ScriptId.eq(script_id))
                .order_by_desc(automation_run::Column::StartedAt)
                .all(&self.db),
        )?;
        items.into_iter().map(to_api_run).collect()
    }

    pub fn get_run(&self, run_id: &str) -> AppResult<AutomationRun> {
        let model = self.find_run_model(run_id)?;
        to_api_run(model)
    }

    pub fn create_run(
        &self,
        script_id: &str,
        profile_id: &str,
        steps_json: &str,
    ) -> AppResult<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = now_ts();
        let model = automation_run::ActiveModel {
            id: Set(id.clone()),
            script_id: Set(script_id.to_string()),
            profile_id: Set(profile_id.to_string()),
            status: Set("running".to_string()),
            steps_json: Set(steps_json.to_string()),
            results_json: Set(None),
            started_at: Set(now),
            finished_at: Set(None),
            error: Set(None),
            variables_json: Set(None),
            cancelled_at: Set(None),
        };
        self.db_query(model.insert(&self.db))?;
        Ok(id)
    }

    pub fn update_run_status(
        &self,
        run_id: &str,
        status: &str,
        results_json: Option<&str>,
        error: Option<&str>,
        finished_at: Option<i64>,
        variables_json: Option<&str>,
    ) -> AppResult<()> {
        let model = self.find_run_model(run_id)?;
        let mut active: automation_run::ActiveModel = model.into();
        active.status = Set(status.to_string());
        active.results_json = Set(results_json.map(|s| s.to_string()));
        active.error = Set(error.map(|s| s.to_string()));
        active.finished_at = Set(finished_at);
        if let Some(vj) = variables_json {
            active.variables_json = Set(Some(vj.to_string()));
        }
        self.db_query(active.update(&self.db))?;
        Ok(())
    }

    fn find_script_model(
        &self,
        script_id: &str,
    ) -> AppResult<automation_script::Model> {
        let model = self.db_query(
            automation_script::Entity::find_by_id(script_id).one(&self.db),
        )?;
        model.ok_or_else(|| {
            AppError::NotFound(format!("automation script not found: {script_id}"))
        })
    }

    fn find_run_model(&self, run_id: &str) -> AppResult<automation_run::Model> {
        let model =
            self.db_query(automation_run::Entity::find_by_id(run_id).one(&self.db))?;
        model
            .ok_or_else(|| AppError::NotFound(format!("automation run not found: {run_id}")))
    }

    fn db_query<F, T>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }

    pub fn update_canvas_positions(
        &self,
        script_id: &str,
        positions_json: String,
    ) -> AppResult<()> {
        let existing = self.find_script_model(script_id)?;
        let mut active: automation_script::ActiveModel = existing.into();
        active.canvas_positions_json = Set(Some(positions_json));
        active.updated_at = Set(now_ts());
        self.db_query(active.update(&self.db))?;
        Ok(())
    }
}

fn to_api_script(model: automation_script::Model) -> AppResult<AutomationScript> {
    let steps: Vec<ScriptStep> = serde_json::from_str(&model.steps_json)
        .map_err(|e| AppError::Validation(format!("corrupt steps_json: {e}")))?;
    Ok(AutomationScript {
        id: model.id,
        name: model.name,
        description: model.description,
        steps,
        canvas_positions_json: model.canvas_positions_json,
        created_at: model.created_at,
        updated_at: model.updated_at,
    })
}

fn to_api_run(model: automation_run::Model) -> AppResult<AutomationRun> {
    let steps: Vec<ScriptStep> = serde_json::from_str(&model.steps_json)
        .map_err(|e| AppError::Validation(format!("corrupt run steps_json: {e}")))?;
    let results: Option<Vec<StepResult>> = model
        .results_json
        .as_deref()
        .map(|s| {
            serde_json::from_str(s)
                .map_err(|e| AppError::Validation(format!("corrupt results_json: {e}")))
        })
        .transpose()?;
    Ok(AutomationRun {
        id: model.id,
        script_id: model.script_id,
        profile_id: model.profile_id,
        status: model.status,
        steps,
        results,
        started_at: model.started_at,
        finished_at: model.finished_at,
        error: model.error,
    })
}
