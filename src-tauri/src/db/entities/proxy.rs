use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "proxies")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i32,
    pub username: Option<String>,
    pub password: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub provider: Option<String>,
    pub note: Option<String>,
    pub check_status: Option<String>,
    pub check_message: Option<String>,
    pub last_checked_at: Option<i64>,
    pub exit_ip: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub geo_accuracy_meters: Option<f64>,
    pub suggested_language: Option<String>,
    pub suggested_timezone: Option<String>,
    pub language_source: Option<String>,
    pub custom_language: Option<String>,
    pub effective_language: Option<String>,
    pub timezone_source: Option<String>,
    pub custom_timezone: Option<String>,
    pub effective_timezone: Option<String>,
    pub target_site_checks_json: Option<String>,
    pub expires_at: Option<i64>,
    pub lifecycle: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
