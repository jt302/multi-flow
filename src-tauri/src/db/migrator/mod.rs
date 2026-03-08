mod m20260307_000001_create_profiles;
mod m20260307_000002_create_proxies_and_bindings;
mod m20260307_000003_create_profile_groups;
mod m20260307_000004_create_engine_sessions;
mod m20260307_000005_add_profile_settings;
mod m20260308_000006_create_device_presets;

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260307_000001_create_profiles::Migration),
            Box::new(m20260307_000002_create_proxies_and_bindings::Migration),
            Box::new(m20260307_000003_create_profile_groups::Migration),
            Box::new(m20260307_000004_create_engine_sessions::Migration),
            Box::new(m20260307_000005_add_profile_settings::Migration),
            Box::new(m20260308_000006_create_device_presets::Migration),
        ]
    }
}
