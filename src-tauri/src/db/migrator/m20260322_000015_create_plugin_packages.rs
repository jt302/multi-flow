use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(PluginPackages::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(PluginPackages::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(PluginPackages::ExtensionId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(PluginPackages::Name).string().not_null())
                    .col(ColumnDef::new(PluginPackages::Version).string().not_null())
                    .col(ColumnDef::new(PluginPackages::Description).text())
                    .col(ColumnDef::new(PluginPackages::IconPath).string())
                    .col(ColumnDef::new(PluginPackages::CrxPath).string().not_null())
                    .col(ColumnDef::new(PluginPackages::SourceType).string().not_null())
                    .col(ColumnDef::new(PluginPackages::StoreUrl).string())
                    .col(ColumnDef::new(PluginPackages::UpdateUrl).string())
                    .col(ColumnDef::new(PluginPackages::LatestVersion).string())
                    .col(ColumnDef::new(PluginPackages::UpdateStatus).string())
                    .col(
                        ColumnDef::new(PluginPackages::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PluginPackages::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_plugin_packages_extension_id")
                    .table(PluginPackages::Table)
                    .col(PluginPackages::ExtensionId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(PluginPackages::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum PluginPackages {
    Table,
    Id,
    ExtensionId,
    Name,
    Version,
    Description,
    IconPath,
    CrxPath,
    SourceType,
    StoreUrl,
    UpdateUrl,
    LatestVersion,
    UpdateStatus,
    CreatedAt,
    UpdatedAt,
}
