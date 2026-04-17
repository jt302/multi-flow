use tauri::{AppHandle, State};

use crate::services::ai_skill_service::{
    AiSkillService, CreateSkillRequest, SkillFull, SkillMeta, UpdateSkillRequest, from_app,
};
use crate::services::chat_service::UpdateChatSessionRequest;
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
pub async fn create_ai_skill(app: AppHandle, payload: CreateSkillRequest) -> Result<SkillFull, String> {
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

// ─── 会话 Skill 绑定 ──────────────────────────────────────────────────────

/// 为会话设置启用的 skill slug 列表
#[tauri::command]
pub async fn set_session_skills(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    skill_slugs: Vec<String>,
) -> Result<(), String> {
    // 过滤掉不存在的 skill，避免死 slug 残留
    let svc = from_app(&app).map_err(|e| e.to_string())?;
    let valid_slugs: Vec<String> = skill_slugs
        .into_iter()
        .filter(|slug| svc.read_skill(slug).is_ok())
        .collect();

    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();

    let req = UpdateChatSessionRequest {
        title: None,
        profile_id: None,
        ai_config_id: None,
        system_prompt: None,
        tool_categories: None,
        profile_ids: None,
        active_profile_id: None,
        enabled_skill_slugs: Some(Some(valid_slugs)),
    };

    chat_svc
        .update_session(&session_id, req)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}
