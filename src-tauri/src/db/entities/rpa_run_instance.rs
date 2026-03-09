use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "rpa_run_instances")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub run_id: i64,
    pub profile_id: i64,
    pub status: String,
    pub current_node_id: Option<String>,
    pub context_json: String,
    pub artifact_index_json: String,
    pub error_message: Option<String>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
