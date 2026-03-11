use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::logger;
use crate::services::rpa_runtime_service::RpaRuntimeService;
use crate::state::AppState;

const RPA_TASKS_UPDATED_EVENT: &str = "rpa:tasks-updated";

pub fn start_rpa_scheduler(app: AppHandle) {
    let _ = thread::Builder::new()
        .name("multi-flow-rpa-scheduler".to_string())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(5));
            let state = app.state::<AppState>();
            if let Err(err) = process_due_tasks(&app, &state) {
                logger::warn("rpa_scheduler", format!("process due tasks failed: {err}"));
            }
        });
}

fn process_due_tasks(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let due_tasks = {
        let task_service = state
            .rpa_task_service
            .lock()
            .map_err(|_| "rpa task service lock poisoned".to_string())?;
        task_service
            .list_due_scheduled_tasks(crate::models::now_ts(), 20)
            .map_err(|err| err.to_string())?
    };

    for task in due_tasks {
        let flow = {
            let flow_service = state
                .rpa_flow_service
                .lock()
                .map_err(|_| "rpa flow service lock poisoned".to_string())?;
            flow_service
                .get_flow(&task.flow_id)
                .map_err(|err| err.to_string())?
                .ok_or_else(|| format!("not found: rpa flow not found: {}", task.flow_id))?
        };

        let run_payload = {
            let task_service = state
                .rpa_task_service
                .lock()
                .map_err(|_| "rpa task service lock poisoned".to_string())?;
            let (_, payload) = task_service
                .build_schedule_run_request(&task.id)
                .map_err(|err| err.to_string())?;
            payload
        };

        let run = {
            let run_service = state
                .rpa_run_service
                .lock()
                .map_err(|_| "rpa run service lock poisoned".to_string())?;
            run_service
                .create_run(&flow, run_payload)
                .map_err(|err| err.to_string())?
        };

        {
            let flow_service = state
                .rpa_flow_service
                .lock()
                .map_err(|_| "rpa flow service lock poisoned".to_string())?;
            flow_service
                .touch_last_run(&flow.id, crate::models::now_ts())
                .map_err(|err| err.to_string())?;
        }

        {
            let task_service = state
                .rpa_task_service
                .lock()
                .map_err(|_| "rpa task service lock poisoned".to_string())?;
            let updated = task_service
                .touch_after_run(&task.id, crate::models::now_ts())
                .map_err(|err| err.to_string())?;
            let _ = app.emit(RPA_TASKS_UPDATED_EVENT, &updated);
        }

        logger::info(
            "rpa_scheduler",
            format!("scheduled run started task_id={} run_id={}", task.id, run.id),
        );
        RpaRuntimeService::spawn_run(app.clone(), run.id);
    }

    Ok(())
}
