use sea_orm::sea_query::Expr;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use serde::{Deserialize, Deserializer, Serialize};

/// 正确反序列化"可选可清空"字段：
/// - JSON 字段缺失 → None（不更新）
/// - JSON 字段为 null → Some(None)（清空）
/// - JSON 字段有值 → Some(Some(value))（设置）
fn double_option<'de, D, T>(d: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(d).map(Some)
}
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::db::entities::{chat_message, chat_session};
use crate::error::{AppError, AppResult};
use crate::models::now_ts;
use crate::services::ai_service::ChatMessage as AiChatMessage;

// ─── API 数据结构 ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub ai_config_id: Option<String>,
    pub system_prompt: Option<String>,
    pub tool_categories: Option<Vec<String>>,
    pub profile_ids: Option<Vec<String>>,
    pub active_profile_id: Option<String>,
    pub enabled_skill_slugs: Vec<String>,
    pub disabled_mcp_server_ids: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageRecord {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content_text: Option<String>,
    pub tool_calls_json: Option<String>,
    pub tool_call_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_args_json: Option<String>,
    pub tool_result: Option<String>,
    pub tool_status: Option<String>,
    pub tool_duration_ms: Option<i64>,
    pub image_base64: Option<String>,
    pub is_active: bool,
    pub created_at: i64,
    pub sort_order: i64,
    pub thinking_text: Option<String>,
    pub thinking_tokens: Option<i32>,
    pub image_ref: Option<String>,
    pub prompt_tokens: Option<i32>,
    pub completion_tokens: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionEvent {
    pub session_id: String,
    pub session: ChatSession,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatSessionRequest {
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub ai_config_id: Option<String>,
    pub system_prompt: Option<String>,
    pub tool_categories: Option<Vec<String>>,
    pub profile_ids: Option<Vec<String>>,
    pub enabled_skill_slugs: Option<Vec<String>>,
    pub disabled_mcp_server_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatSessionRequest {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub profile_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub ai_config_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub system_prompt: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub tool_categories: Option<Option<Vec<String>>>,
    #[serde(default, deserialize_with = "double_option")]
    pub profile_ids: Option<Option<Vec<String>>>,
    #[serde(default, deserialize_with = "double_option")]
    pub active_profile_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub enabled_skill_slugs: Option<Option<Vec<String>>>,
    #[serde(default, deserialize_with = "double_option")]
    pub disabled_mcp_server_ids: Option<Option<Vec<String>>>,
}

// ─── ChatService ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct ChatService {
    db: DatabaseConnection,
}

impl ChatService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // ─── Session CRUD ────────────────────────────────────────────────────

    pub async fn list_sessions(&self) -> AppResult<Vec<ChatSession>> {
        let models = chat_session::Entity::find()
            .order_by_desc(chat_session::Column::UpdatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::from)?;
        Ok(models.into_iter().map(to_api_session).collect())
    }

    pub async fn get_session(&self, id: &str) -> AppResult<ChatSession> {
        let model = self.find_session_model(id).await?;
        Ok(to_api_session(model))
    }

    pub async fn create_session(&self, req: CreateChatSessionRequest) -> AppResult<ChatSession> {
        let now = now_ts();
        let id = Uuid::new_v4().to_string();
        let normalized = normalize_chat_profile_binding(req.profile_id, req.profile_ids, None);
        let model = chat_session::ActiveModel {
            id: Set(id),
            title: Set(req.title.and_then(empty_to_none)),
            profile_id: Set(normalized.profile_id),
            ai_config_id: Set(req.ai_config_id),
            system_prompt: Set(req.system_prompt.and_then(empty_to_none)),
            tool_categories: Set(req
                .tool_categories
                .as_ref()
                .filter(|v| !v.is_empty())
                .and_then(|v| serde_json::to_string(v).ok())),
            profile_ids: Set(normalized
                .profile_ids
                .as_ref()
                .and_then(|v| serde_json::to_string(v).ok())),
            active_profile_id: Set(normalized.active_profile_id),
            enabled_skill_slugs: Set(req
                .enabled_skill_slugs
                .as_ref()
                .filter(|v| !v.is_empty())
                .and_then(|v| serde_json::to_string(v).ok())
                .unwrap_or_else(|| "[]".to_string())),
            disabled_mcp_server_ids: Set(req
                .disabled_mcp_server_ids
                .as_ref()
                .filter(|v| !v.is_empty())
                .and_then(|v| serde_json::to_string(v).ok())
                .unwrap_or_else(|| "[]".to_string())),
            created_at: Set(now),
            updated_at: Set(now),
        };
        let inserted = model.insert(&self.db).await.map_err(AppError::from)?;
        Ok(to_api_session(inserted))
    }

    pub async fn update_session(
        &self,
        id: &str,
        req: UpdateChatSessionRequest,
    ) -> AppResult<ChatSession> {
        let existing = self.find_session_model(id).await?;
        let now = now_ts();
        let current_profile_ids = existing
            .profile_ids
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());
        let current_profile_id = existing.profile_id.clone();
        let current_active_profile_id = existing.active_profile_id.clone();
        let mut model: chat_session::ActiveModel = existing.into();
        model.updated_at = Set(now);

        let mut next_profile_id = current_profile_id;
        let mut next_profile_ids = current_profile_ids;
        let mut next_active_profile_id = current_active_profile_id;

        if let Some(title) = req.title {
            model.title = Set(empty_to_none(title));
        }
        if let Some(profile_id) = req.profile_id {
            next_profile_id = profile_id;
        }
        if let Some(ai_config_id) = req.ai_config_id {
            model.ai_config_id = Set(ai_config_id);
        }
        if let Some(system_prompt) = req.system_prompt {
            model.system_prompt = Set(system_prompt.and_then(empty_to_none));
        }
        if let Some(tool_categories) = req.tool_categories {
            model.tool_categories = Set(tool_categories
                .as_ref()
                .filter(|v| !v.is_empty())
                .and_then(|v| serde_json::to_string(v).ok()));
        }
        if let Some(profile_ids) = req.profile_ids {
            next_profile_ids = profile_ids;
        }
        if let Some(active_profile_id) = req.active_profile_id {
            next_active_profile_id = active_profile_id;
        }

        let normalized = normalize_chat_profile_binding(
            next_profile_id,
            next_profile_ids,
            next_active_profile_id,
        );
        model.profile_id = Set(normalized.profile_id);
        model.profile_ids = Set(normalized
            .profile_ids
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok()));
        model.active_profile_id = Set(normalized.active_profile_id);
        if let Some(slugs_opt) = req.enabled_skill_slugs {
            let slugs = slugs_opt.unwrap_or_default();
            model.enabled_skill_slugs =
                Set(serde_json::to_string(&slugs).unwrap_or_else(|_| "[]".to_string()));
        }
        if let Some(ids_opt) = req.disabled_mcp_server_ids {
            let ids = ids_opt.unwrap_or_default();
            model.disabled_mcp_server_ids =
                Set(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_string()));
        }

        let updated = model.update(&self.db).await.map_err(AppError::from)?;
        Ok(to_api_session(updated))
    }

    pub async fn delete_session(&self, id: &str) -> AppResult<()> {
        chat_session::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::from)?;
        chat_message::Entity::delete_many()
            .filter(chat_message::Column::SessionId.eq(id))
            .exec(&self.db)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    pub async fn touch_session(&self, id: &str) -> AppResult<()> {
        let existing = self.find_session_model(id).await?;
        let mut model: chat_session::ActiveModel = existing.into();
        model.updated_at = Set(now_ts());
        model.update(&self.db).await.map_err(AppError::from)?;
        Ok(())
    }

    // ─── Message CRUD ────────────────────────────────────────────────────

    pub async fn list_messages(&self, session_id: &str) -> AppResult<Vec<ChatMessageRecord>> {
        let models = chat_message::Entity::find()
            .filter(chat_message::Column::SessionId.eq(session_id))
            .filter(chat_message::Column::IsActive.eq(1))
            .order_by_asc(chat_message::Column::SortOrder)
            .all(&self.db)
            .await
            .map_err(AppError::from)?;
        Ok(models.into_iter().map(to_api_message).collect())
    }

    pub async fn add_message(
        &self,
        session_id: &str,
        role: &str,
        content_text: Option<String>,
        tool_calls_json: Option<String>,
        tool_call_id: Option<String>,
        tool_name: Option<String>,
        tool_args_json: Option<String>,
        tool_result: Option<String>,
        tool_status: Option<String>,
        tool_duration_ms: Option<i64>,
        image_base64: Option<String>,
        image_ref: Option<String>,
    ) -> AppResult<ChatMessageRecord> {
        let sort_order = self.next_sort_order(session_id).await?;
        let now = now_ts();
        let id = Uuid::new_v4().to_string();
        let model = chat_message::ActiveModel {
            id: Set(id),
            session_id: Set(session_id.to_string()),
            role: Set(role.to_string()),
            content_text: Set(content_text),
            content_json: Set(None),
            tool_calls_json: Set(tool_calls_json),
            tool_call_id: Set(tool_call_id),
            tool_name: Set(tool_name),
            tool_args_json: Set(tool_args_json),
            tool_result: Set(tool_result),
            tool_status: Set(tool_status),
            tool_duration_ms: Set(tool_duration_ms),
            image_base64: Set(image_base64),
            image_ref: Set(image_ref),
            parent_id: Set(None),
            is_active: Set(1),
            created_at: Set(now),
            sort_order: Set(sort_order),
            thinking_text: Set(None),
            thinking_tokens: Set(None),
            prompt_tokens: Set(None),
            completion_tokens: Set(None),
            compression_meta: Set(None),
        };
        let inserted = model.insert(&self.db).await.map_err(AppError::from)?;
        Ok(to_api_message(inserted))
    }

    /// 使用预生成 id 插入消息（流式场景：前端占位 id 必须与 DB id 一致）
    #[allow(clippy::too_many_arguments)]
    pub async fn add_message_with_id(
        &self,
        id: &str,
        session_id: &str,
        role: &str,
        content_text: Option<String>,
        tool_calls_json: Option<String>,
        tool_call_id: Option<String>,
        tool_name: Option<String>,
        tool_args_json: Option<String>,
        tool_result: Option<String>,
        tool_status: Option<String>,
        tool_duration_ms: Option<i64>,
        image_base64: Option<String>,
        image_ref: Option<String>,
    ) -> AppResult<ChatMessageRecord> {
        let sort_order = self.next_sort_order(session_id).await?;
        let now = now_ts();
        let model = chat_message::ActiveModel {
            id: Set(id.to_string()),
            session_id: Set(session_id.to_string()),
            role: Set(role.to_string()),
            content_text: Set(content_text),
            content_json: Set(None),
            tool_calls_json: Set(tool_calls_json),
            tool_call_id: Set(tool_call_id),
            tool_name: Set(tool_name),
            tool_args_json: Set(tool_args_json),
            tool_result: Set(tool_result),
            tool_status: Set(tool_status),
            tool_duration_ms: Set(tool_duration_ms),
            image_base64: Set(image_base64),
            image_ref: Set(image_ref),
            parent_id: Set(None),
            is_active: Set(1),
            created_at: Set(now),
            sort_order: Set(sort_order),
            thinking_text: Set(None),
            thinking_tokens: Set(None),
            prompt_tokens: Set(None),
            completion_tokens: Set(None),
            compression_meta: Set(None),
        };
        let inserted = model.insert(&self.db).await.map_err(AppError::from)?;
        Ok(to_api_message(inserted))
    }

    /// 更新消息的 token 用量（在 AI 返回后调用）
    pub async fn update_message_usage(
        &self,
        message_id: &str,
        prompt_tokens: Option<i32>,
        completion_tokens: Option<i32>,
    ) -> AppResult<()> {
        let model = chat_message::ActiveModel {
            id: Set(message_id.to_string()),
            prompt_tokens: Set(prompt_tokens),
            completion_tokens: Set(completion_tokens),
            ..Default::default()
        };
        model.update(&self.db).await.map_err(AppError::from)?;
        Ok(())
    }

    /// 更新消息的思考内容
    pub async fn update_message_thinking(
        &self,
        message_id: &str,
        thinking_text: Option<String>,
        thinking_tokens: Option<i32>,
    ) -> AppResult<()> {
        let model = chat_message::ActiveModel {
            id: Set(message_id.to_string()),
            thinking_text: Set(thinking_text),
            thinking_tokens: Set(thinking_tokens),
            ..Default::default()
        };
        model.update(&self.db).await.map_err(AppError::from)?;
        Ok(())
    }

    /// 删除某 sort_order 之后（含）的所有活跃消息（用于重新生成）
    pub async fn delete_messages_from(&self, session_id: &str, sort_order: i64) -> AppResult<()> {
        chat_message::Entity::delete_many()
            .filter(chat_message::Column::SessionId.eq(session_id))
            .filter(chat_message::Column::SortOrder.gte(sort_order))
            .exec(&self.db)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    pub async fn get_message(&self, id: &str) -> AppResult<ChatMessageRecord> {
        let model = chat_message::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound(format!("chat message not found: {id}")))?;
        Ok(to_api_message(model))
    }

    /// 持久化上下文压缩结果：
    /// 将较旧的 user/assistant/tool 消息标记为 is_active=0，
    /// 并在原位插入 AI 生成的摘要 system 消息。
    pub async fn persist_compression(
        &self,
        session_id: &str,
        keep_recent: usize,
        summary_text: &str,
    ) -> AppResult<()> {
        // 获取所有活跃消息（不含已有的摘要 system 消息）
        let all = self.list_messages(session_id).await?;
        let ai_relevant: Vec<&ChatMessageRecord> = all
            .iter()
            .filter(|r| matches!(r.role.as_str(), "user" | "assistant" | "tool"))
            .collect();

        if ai_relevant.len() <= keep_recent {
            return Ok(());
        }
        let compress_end = ai_relevant.len() - keep_recent;

        // 批量将被压缩的消息设为 is_active=0
        let ids_to_deactivate: Vec<String> = ai_relevant[..compress_end]
            .iter()
            .map(|r| r.id.clone())
            .collect();
        chat_message::Entity::update_many()
            .col_expr(chat_message::Column::IsActive, Expr::value(0i32))
            .filter(chat_message::Column::Id.is_in(ids_to_deactivate))
            .exec(&self.db)
            .await
            .map_err(AppError::from)?;

        // 插入摘要消息，sort_order 取第一条被压缩消息的值（保持时间线顺序）
        let summary_sort = ai_relevant[0].sort_order;
        let meta = serde_json::json!({
            "type": "summary",
            "compressed_count": compress_end,
        })
        .to_string();
        let model = chat_message::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            session_id: Set(session_id.to_string()),
            role: Set("system".to_string()),
            content_text: Set(Some(format!("[Conversation Summary]\n{summary_text}"))),
            compression_meta: Set(Some(meta)),
            sort_order: Set(summary_sort),
            is_active: Set(1),
            created_at: Set(crate::models::now_ts()),
            ..Default::default()
        };
        model.insert(&self.db).await.map_err(AppError::from)?;

        Ok(())
    }

    /// 构建用于 AI 调用的消息历史（转换为 ai_service::ChatMessage 格式）
    pub async fn build_ai_messages(&self, session_id: &str) -> AppResult<Vec<AiChatMessage>> {
        let records = self.list_messages(session_id).await?;
        let mut messages: Vec<AiChatMessage> = Vec::new();

        for r in &records {
            match r.role.as_str() {
                "user" => {
                    let text = r.content_text.clone().unwrap_or_default();
                    if let Some(ref img) = r.image_base64 {
                        let content =
                            crate::services::ai_service::build_vision_content(&text, Some(img));
                        messages.push(AiChatMessage {
                            role: "user".into(),
                            content,
                            tool_calls: None,
                            tool_call_id: None,
                            name: None,
                        });
                    } else {
                        messages.push(AiChatMessage::user(&text));
                    }
                }
                "assistant" => {
                    let text = r.content_text.clone().unwrap_or_default();
                    let tool_calls: Option<Vec<serde_json::Value>> =
                        r.tool_calls_json.as_deref().and_then(|s| {
                            serde_json::from_str(s)
                                .map_err(|e| {
                                    crate::logger::warn(
                                        "chat_service",
                                        format!("Failed to parse tool_calls_json: {e}"),
                                    );
                                    e
                                })
                                .ok()
                        });
                    messages.push(AiChatMessage {
                        role: "assistant".into(),
                        content: crate::services::ai_service::ChatContent::Text(text),
                        tool_calls,
                        tool_call_id: None,
                        name: None,
                    });
                }
                "tool" => {
                    let result = r.tool_result.clone().unwrap_or_default();
                    let id = r.tool_call_id.clone().unwrap_or_default();
                    messages.push(AiChatMessage::tool_result(&id, &result));
                }
                "system" => {
                    // 仅加载压缩摘要消息（以 [Conversation Summary] 开头），跳过普通 system 通知
                    if let Some(ref text) = r.content_text {
                        if text.starts_with("[Conversation Summary]") {
                            messages.push(AiChatMessage::system(text));
                        }
                    }
                }
                _ => {} // skip other system notifications
            }
        }

        Ok(messages)
    }

    // ─── 内部工具方法 ────────────────────────────────────────────────────

    async fn find_session_model(&self, id: &str) -> AppResult<chat_session::Model> {
        chat_session::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound(format!("chat session not found: {id}")))
    }

    async fn next_sort_order(&self, session_id: &str) -> AppResult<i64> {
        let last = chat_message::Entity::find()
            .filter(chat_message::Column::SessionId.eq(session_id))
            .order_by_desc(chat_message::Column::SortOrder)
            .one(&self.db)
            .await
            .map_err(AppError::from)?;
        Ok(last.map(|m| m.sort_order + 1).unwrap_or(0))
    }
}

// ─── 转换函数 ──────────────────────────────────────────────────────────────

fn to_api_session(m: chat_session::Model) -> ChatSession {
    ChatSession {
        tool_categories: m
            .tool_categories
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        profile_ids: m
            .profile_ids
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        enabled_skill_slugs: serde_json::from_str(&m.enabled_skill_slugs).unwrap_or_default(),
        disabled_mcp_server_ids: serde_json::from_str(&m.disabled_mcp_server_ids)
            .unwrap_or_default(),
        active_profile_id: m.active_profile_id,
        id: m.id,
        title: m.title,
        profile_id: m.profile_id,
        ai_config_id: m.ai_config_id,
        system_prompt: m.system_prompt,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }
}

fn to_api_message(m: chat_message::Model) -> ChatMessageRecord {
    ChatMessageRecord {
        is_active: m.is_active != 0,
        id: m.id,
        session_id: m.session_id,
        role: m.role,
        content_text: m.content_text,
        tool_calls_json: m.tool_calls_json,
        tool_call_id: m.tool_call_id,
        tool_name: m.tool_name,
        tool_args_json: m.tool_args_json,
        tool_result: m.tool_result,
        tool_status: m.tool_status,
        tool_duration_ms: m.tool_duration_ms,
        image_base64: m.image_base64,
        created_at: m.created_at,
        sort_order: m.sort_order,
        thinking_text: m.thinking_text,
        thinking_tokens: m.thinking_tokens,
        image_ref: m.image_ref,
        prompt_tokens: m.prompt_tokens,
        completion_tokens: m.completion_tokens,
    }
}

fn empty_to_none(s: String) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

pub fn resolve_chat_tool_target_profile_id(
    profile_id: Option<&str>,
    profile_ids: Option<&[String]>,
    active_profile_id: Option<&str>,
) -> Option<String> {
    active_profile_id
        .and_then(non_empty_str)
        .or_else(|| profile_id.and_then(non_empty_str))
        .map(str::to_string)
        .or_else(|| {
            profile_ids.and_then(|ids| {
                ids.iter()
                    .find_map(|id| non_empty_str(id.as_str()).map(str::to_string))
            })
        })
}

pub fn emit_chat_session_updated(app: &AppHandle, session: &ChatSession) {
    let _ = app.emit(
        "ai_chat://session_updated",
        ChatSessionEvent {
            session_id: session.id.clone(),
            session: session.clone(),
        },
    );
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NormalizedChatProfileBinding {
    profile_id: Option<String>,
    profile_ids: Option<Vec<String>>,
    active_profile_id: Option<String>,
}

fn normalize_chat_profile_binding(
    profile_id: Option<String>,
    profile_ids: Option<Vec<String>>,
    active_profile_id: Option<String>,
) -> NormalizedChatProfileBinding {
    let mut normalized_ids = profile_ids
        .unwrap_or_default()
        .into_iter()
        .filter_map(non_empty_owned)
        .fold(Vec::<String>::new(), |mut acc, id| {
            if !acc.iter().any(|existing| existing == &id) {
                acc.push(id);
            }
            acc
        });

    if normalized_ids.is_empty() {
        if let Some(active) = active_profile_id
            .as_ref()
            .and_then(|id| non_empty_str(id.as_str()))
        {
            normalized_ids.push(active.to_string());
        } else if let Some(current) = profile_id
            .as_ref()
            .and_then(|id| non_empty_str(id.as_str()))
        {
            normalized_ids.push(current.to_string());
        }
    }

    let resolved_active = if normalized_ids.is_empty() {
        None
    } else {
        active_profile_id
            .as_deref()
            .and_then(non_empty_str)
            .filter(|candidate| normalized_ids.iter().any(|id| id == candidate))
            .map(str::to_string)
            .or_else(|| {
                profile_id
                    .as_deref()
                    .and_then(non_empty_str)
                    .filter(|candidate| normalized_ids.iter().any(|id| id == candidate))
                    .map(str::to_string)
            })
            .or_else(|| normalized_ids.first().cloned())
    };

    NormalizedChatProfileBinding {
        profile_id: resolved_active.clone(),
        profile_ids: (!normalized_ids.is_empty()).then_some(normalized_ids),
        active_profile_id: resolved_active,
    }
}

fn non_empty_str(input: &str) -> Option<&str> {
    Some(str::trim(input)).filter(|value| !value.is_empty())
}

fn non_empty_owned(input: String) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn create_session_with_profile_ids_mirrors_legacy_profile_id() {
        let db = db::init_test_database().expect("init test db");
        let service = ChatService::from_db(db);

        tauri::async_runtime::block_on(async {
            let session = service
                .create_session(CreateChatSessionRequest {
                    title: Some("multi".to_string()),
                    profile_id: None,
                    ai_config_id: None,
                    system_prompt: None,
                    tool_categories: None,
                    profile_ids: Some(vec!["pf_a".to_string(), "pf_b".to_string()]),
                    enabled_skill_slugs: None,
                    disabled_mcp_server_ids: None,
                })
                .await
                .expect("create session");

            assert_eq!(
                session.profile_ids,
                Some(vec!["pf_a".to_string(), "pf_b".to_string()])
            );
            assert_eq!(session.active_profile_id.as_deref(), Some("pf_a"));
            assert_eq!(session.profile_id.as_deref(), Some("pf_a"));
        });
    }

    #[test]
    fn update_session_active_profile_mirrors_legacy_profile_id() {
        let db = db::init_test_database().expect("init test db");
        let service = ChatService::from_db(db);

        tauri::async_runtime::block_on(async {
            let session = service
                .create_session(CreateChatSessionRequest {
                    title: Some("multi".to_string()),
                    profile_id: None,
                    ai_config_id: None,
                    system_prompt: None,
                    tool_categories: None,
                    profile_ids: Some(vec!["pf_a".to_string(), "pf_b".to_string()]),
                    enabled_skill_slugs: None,
                    disabled_mcp_server_ids: None,
                })
                .await
                .expect("create session");

            let updated = service
                .update_session(
                    &session.id,
                    UpdateChatSessionRequest {
                        title: None,
                        profile_id: None,
                        ai_config_id: None,
                        system_prompt: None,
                        tool_categories: None,
                        profile_ids: None,
                        active_profile_id: Some(Some("pf_b".to_string())),
                        enabled_skill_slugs: None,
                        disabled_mcp_server_ids: None,
                    },
                )
                .await
                .expect("update session");

            assert_eq!(
                updated.profile_ids,
                Some(vec!["pf_a".to_string(), "pf_b".to_string()])
            );
            assert_eq!(updated.active_profile_id.as_deref(), Some("pf_b"));
            assert_eq!(updated.profile_id.as_deref(), Some("pf_b"));
        });
    }

    #[test]
    fn resolve_tool_target_prefers_active_then_legacy_then_first_profile() {
        assert_eq!(
            resolve_chat_tool_target_profile_id(
                Some("pf_legacy"),
                Some(&["pf_a".to_string(), "pf_b".to_string()]),
                Some("pf_active"),
            ),
            Some("pf_active".to_string()),
        );
        assert_eq!(
            resolve_chat_tool_target_profile_id(
                Some("pf_legacy"),
                Some(&["pf_a".to_string(), "pf_b".to_string()]),
                None,
            ),
            Some("pf_legacy".to_string()),
        );
        assert_eq!(
            resolve_chat_tool_target_profile_id(
                None,
                Some(&["pf_a".to_string(), "pf_b".to_string()]),
                None,
            ),
            Some("pf_a".to_string()),
        );
    }

    #[test]
    fn build_ai_messages_does_not_reinject_historical_tool_screenshot_images() {
        let db = db::init_test_database().expect("init test db");
        let service = ChatService::from_db(db);

        tauri::async_runtime::block_on(async {
            let session = service
                .create_session(CreateChatSessionRequest {
                    title: Some("chat".to_string()),
                    profile_id: Some("pf_a".to_string()),
                    ai_config_id: None,
                    system_prompt: None,
                    tool_categories: None,
                    profile_ids: None,
                    enabled_skill_slugs: None,
                    disabled_mcp_server_ids: None,
                })
                .await
                .expect("create session");

            service
                .add_message(
                    &session.id,
                    "tool",
                    None,
                    None,
                    Some("tool_call_1".to_string()),
                    Some("cdp_screenshot".to_string()),
                    None,
                    Some("/tmp/chat-shot.png".to_string()),
                    Some("completed".to_string()),
                    Some(12),
                    Some("ZmFrZS1iYXNlNjQ=".to_string()),
                    None,
                )
                .await
                .expect("add tool message");

            let messages = service
                .build_ai_messages(&session.id)
                .await
                .expect("build ai messages");

            assert_eq!(messages.len(), 1);
            assert!(matches!(
                &messages[0].content,
                crate::services::ai_service::ChatContent::Text(text)
                    if text == "/tmp/chat-shot.png"
            ));
        });
    }
}
