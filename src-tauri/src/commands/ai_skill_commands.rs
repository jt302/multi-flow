use tauri::{AppHandle, State};

use crate::services::ai_skill_service::{
    CreateSkillRequest, SkillFull, SkillMeta, UpdateSkillRequest, from_app,
};
use crate::services::chat_service::UpdateChatSessionRequest;
use crate::services::skill_install_service::{InstallSkillRequest, InstallSkillResult, SkillInstallService};
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

pub(crate) async fn install_ai_skill_inner(
    app: &AppHandle,
    state: &AppState,
    client: &reqwest::Client,
    payload: InstallSkillRequest,
) -> Result<InstallSkillResult, String> {
    let install_svc = SkillInstallService::from_app(app).map_err(|e| e.to_string())?;
    let enable_for_session = payload.enable_for_session.unwrap_or(true);
    let session_id = payload.session_id.clone();

    let mut installed = install_svc
        .install_from_source(client, &payload)
        .await
        .map_err(|e| e.to_string())?;

    if enable_for_session {
        if let Some(session_id) = session_id.as_deref() {
            let _ = add_skill_to_session(state, app, session_id, &installed.slug).await?;
            installed.enabled_for_session = true;
        } else {
            installed
                .warnings
                .push("安装成功，但当前没有可用会话，未自动启用".to_string());
        }
    }

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

// ─── 会话 Skill 绑定 ──────────────────────────────────────────────────────

async fn add_skill_to_session(
    state: &AppState,
    app: &AppHandle,
    session_id: &str,
    skill_slug: &str,
) -> Result<Vec<String>, String> {
    let svc = from_app(app).map_err(|e| e.to_string())?;
    if svc.read_skill(skill_slug).is_err() {
        return Err(format!("skill '{}' 不存在", skill_slug));
    }

    let chat_svc = state
        .chat_service
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();

    let session = chat_svc
        .get_session(session_id)
        .await
        .map_err(|e| e.to_string())?;
    let mut valid_slugs = session.enabled_skill_slugs;
    if !valid_slugs.iter().any(|slug| slug == skill_slug) {
        valid_slugs.push(skill_slug.to_string());
    }

    let req = UpdateChatSessionRequest {
        title: None,
        profile_id: None,
        ai_config_id: None,
        system_prompt: None,
        tool_categories: None,
        profile_ids: None,
        active_profile_id: None,
        enabled_skill_slugs: Some(Some(valid_slugs.clone())),
        disabled_mcp_server_ids: None,
    };

    chat_svc
        .update_session(session_id, req)
        .await
        .map_err(|e| e.to_string())?;

    Ok(valid_slugs)
}

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
        disabled_mcp_server_ids: None,
    };

    chat_svc
        .update_session(&session_id, req)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}
