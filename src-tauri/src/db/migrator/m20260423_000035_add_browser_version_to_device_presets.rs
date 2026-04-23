use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(Iden)]
enum DevicePresets {
    Table,
    BrowserVersion,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(DevicePresets::Table)
                    .add_column(
                        ColumnDef::new(DevicePresets::BrowserVersion)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .to_owned(),
            )
            .await?;

        // Backfill catalog latest for each platform (snapshot 2026-04-23)
        let db = manager.get_connection();
        let backfills = [
            ("macos", "147.0.7727.117"),
            ("windows", "147.0.7727.117"),
            ("linux", "147.0.7727.116"),
            ("android", "148.0.7778.49"),
            ("ios", "148.0.7778.47"),
        ];
        for (platform, version) in backfills {
            db.execute_unprepared(&format!(
                "UPDATE device_presets SET browser_version = '{version}' WHERE platform = '{platform}'"
            ))
            .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite < 3.35 does not support DROP COLUMN; leave down migration as no-op.
        // If your SQLite supports it, uncomment below:
        // manager.alter_table(Table::alter().table(DevicePresets::Table)
        //     .drop_column(DevicePresets::BrowserVersion).to_owned()).await?;
        let _ = manager;
        Ok(())
    }
}
