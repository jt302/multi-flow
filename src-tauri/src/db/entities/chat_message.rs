use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "chat_messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content_text: Option<String>,
    pub content_json: Option<String>,
    pub tool_calls_json: Option<String>,
    pub tool_call_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_args_json: Option<String>,
    pub tool_result: Option<String>,
    pub tool_status: Option<String>,
    pub tool_duration_ms: Option<i64>,
    pub image_base64: Option<String>,
    pub parent_id: Option<String>,
    pub is_active: i32,
    pub created_at: i64,
    pub sort_order: i64,
    pub thinking_text: Option<String>,
    pub thinking_tokens: Option<i32>,
    pub image_ref: Option<String>,
    pub prompt_tokens: Option<i32>,
    pub completion_tokens: Option<i32>,
    pub compression_meta: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
