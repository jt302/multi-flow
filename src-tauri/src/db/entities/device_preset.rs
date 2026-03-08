use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "device_presets")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub preset_key: String,
    pub label: String,
    pub platform: String,
    pub platform_version: String,
    pub viewport_width: i32,
    pub viewport_height: i32,
    pub device_scale_factor: f32,
    pub touch_points: i32,
    pub custom_platform: String,
    pub arch: String,
    pub bitness: String,
    pub mobile: bool,
    pub form_factor: String,
    pub user_agent_template: String,
    pub custom_gl_vendor: String,
    pub custom_gl_renderer: String,
    pub custom_cpu_cores: i32,
    pub custom_ram_gb: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
