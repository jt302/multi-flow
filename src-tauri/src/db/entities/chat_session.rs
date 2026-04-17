use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "chat_sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub ai_config_id: Option<String>,
    pub system_prompt: Option<String>,
    pub tool_categories: Option<String>,
    pub profile_ids: Option<String>,
    pub active_profile_id: Option<String>,
    pub enabled_skill_slugs: String,
    pub disabled_mcp_server_ids: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
