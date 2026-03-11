use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "rpa_tasks")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub flow_id: i64,
    pub name: String,
    pub run_type: String,
    pub execution_mode: String,
    pub concurrency_limit: i32,
    pub cron_expr: Option<String>,
    pub start_at: Option<i64>,
    pub timezone: String,
    pub enabled: bool,
    pub runtime_input_json: String,
    pub lifecycle: String,
    pub deleted_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
