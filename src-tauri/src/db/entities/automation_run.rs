use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "automation_runs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub script_id: String,
    pub profile_id: String,
    pub status: String,
    pub steps_json: String,
    pub results_json: Option<String>,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub error: Option<String>,
    pub variables_json: Option<String>,
    pub cancelled_at: Option<i64>,
    #[sea_orm(column_type = "Text", nullable)]
    pub logs_json: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
