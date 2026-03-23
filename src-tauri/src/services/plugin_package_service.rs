use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use crate::db::entities::plugin_package;
use crate::error::{AppError, AppResult};
use crate::models::{now_ts, PluginPackage, SavePluginPackageInput};

pub struct PluginPackageService {
    db: DatabaseConnection,
}

impl PluginPackageService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn list_packages(&self) -> AppResult<Vec<PluginPackage>> {
        let items = self.db_query(
            plugin_package::Entity::find()
                .order_by_asc(plugin_package::Column::Name)
                .all(&self.db),
        )?;
        Ok(items.into_iter().map(to_api_plugin_package).collect())
    }

    pub fn get_package(&self, package_id: &str) -> AppResult<PluginPackage> {
        let model = self.find_package_model(package_id)?;
        Ok(to_api_plugin_package(model))
    }

    pub fn get_package_by_extension_id(&self, extension_id: &str) -> AppResult<Option<PluginPackage>> {
        let extension_id = extension_id.trim();
        if extension_id.is_empty() {
            return Ok(None);
        }
        let model = self.db_query(
            plugin_package::Entity::find()
                .filter(plugin_package::Column::ExtensionId.eq(extension_id))
                .one(&self.db),
        )?;
        Ok(model.map(to_api_plugin_package))
    }

    pub fn save_package(&self, input: SavePluginPackageInput) -> AppResult<PluginPackage> {
        let package_id = input.package_id.trim();
        let extension_id = input.extension_id.trim();
        let name = input.name.trim();
        let version = input.version.trim();
        let source_type = input.source_type.trim();
        let crx_path = input.crx_path.trim();
        if package_id.is_empty()
            || extension_id.is_empty()
            || name.is_empty()
            || version.is_empty()
            || source_type.is_empty()
            || crx_path.is_empty()
        {
            return Err(AppError::Validation(
                "plugin package requires package_id, extension_id, name, version, source_type and crx_path"
                    .to_string(),
            ));
        }
        let existing = self
            .db_query(
                plugin_package::Entity::find()
                    .filter(plugin_package::Column::Id.eq(package_id))
                    .one(&self.db),
            )?;
        let now = now_ts();
        let model = if let Some(existing) = existing {
            let mut active_model: plugin_package::ActiveModel = existing.into();
            active_model.extension_id = Set(extension_id.to_string());
            active_model.name = Set(name.to_string());
            active_model.version = Set(version.to_string());
            active_model.description = Set(trim_to_option(input.description));
            active_model.icon_path = Set(trim_to_option(input.icon_path));
            active_model.crx_path = Set(crx_path.to_string());
            active_model.source_type = Set(source_type.to_string());
            active_model.store_url = Set(trim_to_option(input.store_url));
            active_model.update_url = Set(trim_to_option(input.update_url));
            active_model.latest_version = Set(trim_to_option(input.latest_version));
            active_model.update_status = Set(trim_to_option(input.update_status));
            active_model.updated_at = Set(now);
            self.db_query(active_model.update(&self.db))?
        } else {
            let active_model = plugin_package::ActiveModel {
                id: Set(package_id.to_string()),
                extension_id: Set(extension_id.to_string()),
                name: Set(name.to_string()),
                version: Set(version.to_string()),
                description: Set(trim_to_option(input.description)),
                icon_path: Set(trim_to_option(input.icon_path)),
                crx_path: Set(crx_path.to_string()),
                source_type: Set(source_type.to_string()),
                store_url: Set(trim_to_option(input.store_url)),
                update_url: Set(trim_to_option(input.update_url)),
                latest_version: Set(trim_to_option(input.latest_version)),
                update_status: Set(trim_to_option(input.update_status)),
                created_at: Set(now),
                updated_at: Set(now),
            };
            self.db_query(active_model.insert(&self.db))?
        };
        Ok(to_api_plugin_package(model))
    }

    pub fn delete_package(&self, package_id: &str) -> AppResult<PluginPackage> {
        let model = self.find_package_model(package_id)?;
        let active_model: plugin_package::ActiveModel = model.clone().into();
        self.db_query(active_model.delete(&self.db))?;
        Ok(to_api_plugin_package(model))
    }

    fn find_package_model(&self, package_id: &str) -> AppResult<plugin_package::Model> {
        let package_id = package_id.trim();
        if package_id.is_empty() {
            return Err(AppError::Validation("package_id is required".to_string()));
        }
        let model = self.db_query(plugin_package::Entity::find_by_id(package_id).one(&self.db))?;
        model.ok_or_else(|| AppError::NotFound(format!("plugin package not found: {package_id}")))
    }

    fn db_query<F, T>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }
}

fn to_api_plugin_package(model: plugin_package::Model) -> PluginPackage {
    PluginPackage {
        package_id: model.id,
        extension_id: model.extension_id,
        name: model.name,
        version: model.version,
        description: model.description,
        icon_path: model.icon_path,
        crx_path: model.crx_path,
        source_type: model.source_type,
        store_url: model.store_url,
        update_url: model.update_url,
        latest_version: model.latest_version,
        update_status: model.update_status,
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn trim_to_option(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}
