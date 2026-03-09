use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "rpa_run_steps")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub run_instance_id: i64,
    pub node_id: String,
    pub node_kind: String,
    pub status: String,
    pub attempt: i32,
    pub input_snapshot_json: String,
    pub output_snapshot_json: String,
    pub error_message: Option<String>,
    pub artifact_index_json: String,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
