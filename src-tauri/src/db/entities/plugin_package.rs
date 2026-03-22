use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "plugin_packages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub extension_id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub icon_path: Option<String>,
    pub crx_path: String,
    pub source_type: String,
    pub store_url: Option<String>,
    pub update_url: Option<String>,
    pub latest_version: Option<String>,
    pub update_status: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
