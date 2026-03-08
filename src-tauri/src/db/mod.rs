pub mod entities;
mod migrator;

use std::fs;
use std::path::Path;

use sea_orm::{ActiveModelTrait, Database, DatabaseConnection, EntityTrait, PaginatorTrait, Set};
use sea_orm_migration::MigratorTrait;
use serde::Deserialize;
use tauri::{AppHandle, Manager};

use self::entities::profile;
use crate::error::{AppError, AppResult};

pub fn init_database(app: &AppHandle) -> AppResult<DatabaseConnection> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| AppError::Validation(format!("failed to resolve app data dir: {err}")))?;
    fs::create_dir_all(&data_dir)?;

    let db_path = data_dir.join("multi-flow.sqlite3");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let db = tauri::async_runtime::block_on(Database::connect(&db_url))?;

    tauri::async_runtime::block_on(migrator::Migrator::up(&db, None))?;
    let legacy_store_path = data_dir.join("profiles.json");
    tauri::async_runtime::block_on(import_legacy_profiles_if_needed(&db, &legacy_store_path))?;
    Ok(db)
}

#[cfg(test)]
pub fn init_test_database() -> AppResult<DatabaseConnection> {
    let db = tauri::async_runtime::block_on(Database::connect("sqlite::memory:"))?;
    tauri::async_runtime::block_on(migrator::Migrator::up(&db, None))?;
    Ok(db)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyStore {
    profiles: Vec<LegacyProfile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyProfile {
    id: String,
    name: String,
    group: Option<String>,
    note: Option<String>,
    lifecycle: LegacyLifecycle,
    running: bool,
    created_at: i64,
    updated_at: i64,
    deleted_at: Option<i64>,
    last_opened_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum LegacyLifecycle {
    Active,
    Deleted,
}

async fn import_legacy_profiles_if_needed(
    db: &DatabaseConnection,
    legacy_store_path: &Path,
) -> AppResult<()> {
    if !legacy_store_path.exists() {
        return Ok(());
    }

    let existing_count = profile::Entity::find().count(db).await?;
    if existing_count > 0 {
        return Ok(());
    }

    let content = fs::read_to_string(legacy_store_path)?;
    if content.trim().is_empty() {
        return Ok(());
    }

    let store: LegacyStore = serde_json::from_str(&content)?;
    for item in store.profiles {
        let mut active_model = profile::ActiveModel {
            name: Set(item.name),
            group_name: Set(item.group),
            note: Set(item.note),
            settings_json: Set(None),
            lifecycle: Set(match item.lifecycle {
                LegacyLifecycle::Active => "active".to_string(),
                LegacyLifecycle::Deleted => "deleted".to_string(),
            }),
            running: Set(item.running),
            created_at: Set(item.created_at),
            updated_at: Set(item.updated_at),
            deleted_at: Set(item.deleted_at),
            last_opened_at: Set(item.last_opened_at),
            ..Default::default()
        };

        if let Some(parsed_id) = parse_profile_id(&item.id) {
            active_model.id = Set(parsed_id);
        }

        active_model.insert(db).await?;
    }

    let migrated_path = legacy_store_path.with_extension("json.migrated");
    let _ = fs::rename(legacy_store_path, migrated_path);

    Ok(())
}

fn parse_profile_id(value: &str) -> Option<i64> {
    value
        .strip_prefix("pf_")
        .unwrap_or(value)
        .parse::<i64>()
        .ok()
}
