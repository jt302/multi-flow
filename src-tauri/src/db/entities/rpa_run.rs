use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "rpa_runs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub flow_id: i64,
    pub flow_name: String,
    pub trigger_source: String,
    pub status: String,
    pub total_instances: i32,
    pub success_count: i32,
    pub failed_count: i32,
    pub cancelled_count: i32,
    pub concurrency_limit: i32,
    pub definition_snapshot_json: String,
    pub runtime_input_json: String,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
