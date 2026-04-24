use tauri::{AppHandle, State};

use crate::services::ai_skill_service::{
    from_app, CreateSkillRequest, SkillFull, SkillMeta, UpdateSkillRequest,
};
use crate::services::skill_install_service::{
    InstallSkillRequest, InstallSkillResult, SkillInstallService,
};
use crate::state::AppState;

// ─── Skill CRUD ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_ai_skills(app: AppHandle) -> Result<Vec<SkillMeta>, String> {
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    svc.list_skills().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_ai_skill(app: AppHandle, slug: String) -> Result<SkillFull, String> {
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    svc.read_skill(&slug).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_ai_skill(
    app: AppHandle,
    payload: CreateSkillRequest,
) -> Result<SkillFull, String> {
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    svc.create_skill(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_ai_skill(
    app: AppHandle,
    slug: String,
    payload: UpdateSkillRequest,
) -> Result<SkillFull, String> {
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    svc.update_skill(&slug, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_ai_skill(app: AppHandle, slug: String) -> Result<(), String> {
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    svc.delete_skill(&slug).map_err(|e| e.to_string())
}

pub(crate) async fn install_ai_skill_inner(
    app: &AppHandle,
    _state: &AppState,
    client: &reqwest::Client,
    payload: InstallSkillRequest,
) -> Result<InstallSkillResult, String> {
    let install_svc = SkillInstallService::from_app(app).map_err(|e| e.to_string())?;
    let installed = install_svc
        .install_from_source(client, &payload)
        .await
        .map_err(|e| e.to_string())?;

    Ok(installed)
}

#[tauri::command]
pub async fn install_ai_skill(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: InstallSkillRequest,
) -> Result<InstallSkillResult, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;
    install_ai_skill_inner(&app, &state, &client, payload).await
}
