mod m20260307_000001_create_profiles;
mod m20260307_000002_create_proxies_and_bindings;
mod m20260307_000003_create_profile_groups;
mod m20260307_000004_create_engine_sessions;
mod m20260307_000005_add_profile_settings;
mod m20260308_000006_create_device_presets;
mod m20260309_000007_create_proxy_runtime_instances;
mod m20260309_000008_add_proxy_health_fields;
mod m20260309_000009_add_proxy_portrait_fields;
mod m20260309_000010_create_rpa_tables;
mod m20260310_000011_add_proxy_locale_fields;
mod m20260310_000012_add_proxy_target_site_checks;
mod m20260310_000012_rebuild_proxy_runtime_instances;
mod m20260311_000013_create_rpa_tasks;
mod m20260321_000014_drop_rpa_tables;
mod m20260322_000015_create_plugin_packages;
mod m20260322_000016_create_agent_tasks;
mod m20260323_000016_create_agent_runtime_tables;
mod m20260323_000017_drop_agent_tables;
mod m20260326_000018_create_automation_scripts;
mod m20260327_000019_automation_v2;
mod m20260327_000020_automation_canvas;
mod m20260327_000021_script_variables_schema;
mod m20260331_000022_script_profile_and_ai_config;
mod m20260331_000023_script_settings;
mod m20260401_000024_script_ai_config_id;
mod m20260401_000025_automation_run_logs;
mod m20260402_000026_clean_legacy_ai_steps;
mod m20260405_000027_create_chat_tables;
mod m20260406_000028_enhance_chat_system;
mod m20260406_000029_add_engine_session_ports;
mod m20260417_000030_add_profile_group_visuals;
mod m20260417_000031_chat_sessions_skills;

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
            Box::new(m20260309_000007_create_proxy_runtime_instances::Migration),
            Box::new(m20260309_000008_add_proxy_health_fields::Migration),
            Box::new(m20260309_000009_add_proxy_portrait_fields::Migration),
            Box::new(m20260309_000010_create_rpa_tables::Migration),
            Box::new(m20260310_000011_add_proxy_locale_fields::Migration),
            Box::new(m20260310_000012_rebuild_proxy_runtime_instances::Migration),
            Box::new(m20260310_000012_add_proxy_target_site_checks::Migration),
            Box::new(m20260311_000013_create_rpa_tasks::Migration),
            Box::new(m20260321_000014_drop_rpa_tables::Migration),
            Box::new(m20260322_000015_create_plugin_packages::Migration),
            Box::new(m20260322_000016_create_agent_tasks::Migration),
            Box::new(m20260323_000016_create_agent_runtime_tables::Migration),
            Box::new(m20260323_000017_drop_agent_tables::Migration),
            Box::new(m20260326_000018_create_automation_scripts::Migration),
            Box::new(m20260327_000019_automation_v2::Migration),
            Box::new(m20260327_000020_automation_canvas::Migration),
            Box::new(m20260327_000021_script_variables_schema::Migration),
            Box::new(m20260331_000022_script_profile_and_ai_config::Migration),
            Box::new(m20260331_000023_script_settings::Migration),
            Box::new(m20260401_000024_script_ai_config_id::Migration),
            Box::new(m20260401_000025_automation_run_logs::Migration),
            Box::new(m20260402_000026_clean_legacy_ai_steps::Migration),
            Box::new(m20260405_000027_create_chat_tables::Migration),
            Box::new(m20260406_000028_enhance_chat_system::Migration),
            Box::new(m20260406_000029_add_engine_session_ports::Migration),
            Box::new(m20260417_000030_add_profile_group_visuals::Migration),
            Box::new(m20260417_000031_chat_sessions_skills::Migration),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{ConnectionTrait, Database, Statement};

    #[test]
    fn includes_legacy_rebuild_proxy_runtime_instances_migration() {
        let names = Migrator::migrations()
            .into_iter()
            .map(|migration| migration.name().to_string())
            .collect::<Vec<_>>();

        assert!(
            names.contains(&"m20260310_000012_rebuild_proxy_runtime_instances".to_string()),
            "missing legacy migration for already-applied local databases"
        );
    }

    #[test]
    fn includes_drop_rpa_migration_and_removes_rpa_tables() {
        tauri::async_runtime::block_on(async {
            let names = Migrator::migrations()
                .into_iter()
                .map(|migration| migration.name().to_string())
                .collect::<Vec<_>>();
            assert!(
                names.contains(&"m20260321_000014_drop_rpa_tables".to_string()),
                "missing rpa drop migration for removing legacy automation tables"
            );

            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            let rows = db
                .query_all(Statement::from_string(
                    db.get_database_backend(),
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'rpa_%' ORDER BY name"
                        .to_string(),
                ))
                .await
                .expect("query sqlite master");
            let tables = rows
                .iter()
                .filter_map(|row| row.try_get::<String>("", "name").ok())
                .collect::<Vec<_>>();

            assert!(!tables.iter().any(|name| name == "rpa_flows"));
            assert!(!tables.iter().any(|name| name == "rpa_tasks"));
        });
    }

    #[test]
    fn includes_plugin_packages_migration_and_creates_table() {
        tauri::async_runtime::block_on(async {
            let names = Migrator::migrations()
                .into_iter()
                .map(|migration| migration.name().to_string())
                .collect::<Vec<_>>();
            assert!(
                names.contains(&"m20260322_000015_create_plugin_packages".to_string()),
                "missing plugin packages migration"
            );

            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            let rows = db
                .query_all(Statement::from_string(
                    db.get_database_backend(),
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'plugin_packages'"
                        .to_string(),
                ))
                .await
                .expect("query sqlite master");
            assert_eq!(rows.len(), 1, "plugin_packages table should exist");
        });
    }

    #[test]
    fn includes_drop_agent_migration_and_removes_tables() {
        tauri::async_runtime::block_on(async {
            let names = Migrator::migrations()
                .into_iter()
                .map(|migration| migration.name().to_string())
                .collect::<Vec<_>>();
            assert!(
                names.contains(&"m20260323_000017_drop_agent_tables".to_string()),
                "missing agent drop migration"
            );

            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            for table in [
                "agent_provider_profiles",
                "agent_sessions",
                "agent_session_events",
                "agent_handoffs",
            ] {
                let rows = db
                    .query_all(Statement::from_string(
                        db.get_database_backend(),
                        format!(
                            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '{table}'"
                        ),
                    ))
                    .await
                    .expect("query sqlite master");
                assert_eq!(rows.len(), 0, "{table} table should be removed");
            }
        });
    }

    #[test]
    fn includes_legacy_agent_tasks_compat_migration() {
        let names = Migrator::migrations()
            .into_iter()
            .map(|migration| migration.name().to_string())
            .collect::<Vec<_>>();

        assert!(
            names.contains(&"m20260322_000016_create_agent_tasks".to_string()),
            "missing compatibility migration for previously applied agent tasks version"
        );
    }

    #[test]
    fn includes_automation_v2_migration_and_adds_columns() {
        tauri::async_runtime::block_on(async {
            let names = Migrator::migrations()
                .into_iter()
                .map(|migration| migration.name().to_string())
                .collect::<Vec<_>>();
            assert!(
                names.contains(&"m20260327_000019_automation_v2".to_string()),
                "missing automation v2 migration"
            );

            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            // 检查新列存在（SELECT 不报错即可）
            db.execute_unprepared(
                "SELECT variables_json, cancelled_at FROM automation_runs LIMIT 0",
            )
            .await
            .expect("automation_runs should have variables_json and cancelled_at columns");
        });
    }

    #[test]
    fn includes_automation_scripts_migration_and_creates_tables() {
        tauri::async_runtime::block_on(async {
            let names = Migrator::migrations()
                .into_iter()
                .map(|migration| migration.name().to_string())
                .collect::<Vec<_>>();
            assert!(
                names.contains(&"m20260326_000018_create_automation_scripts".to_string()),
                "missing automation scripts migration"
            );

            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            for table in ["automation_scripts", "automation_runs"] {
                let rows = db
                    .query_all(Statement::from_string(
                        db.get_database_backend(),
                        format!(
                            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '{table}'"
                        ),
                    ))
                    .await
                    .expect("query sqlite master");
                assert_eq!(rows.len(), 1, "{table} table should exist");
            }
        });
    }

    #[test]
    fn profile_groups_visual_columns_exist() {
        tauri::async_runtime::block_on(async {
            let db = Database::connect("sqlite::memory:").await.expect("connect");
            Migrator::up(&db, None).await.expect("run migrations");

            db.execute_unprepared(
                "SELECT browser_bg_color, toolbar_label_mode FROM profile_groups LIMIT 0",
            )
            .await
            .expect("profile_groups should have visual columns");
        });
    }
}
