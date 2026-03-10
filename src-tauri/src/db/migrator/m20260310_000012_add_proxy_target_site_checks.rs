use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        add_column_if_missing(
            manager,
            "target_site_checks_json",
            ColumnDef::new(Alias::new("target_site_checks_json"))
                .string()
                .null(),
        )
        .await
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

async fn add_column_if_missing(
    manager: &SchemaManager<'_>,
    column_name: &str,
    column_def: &mut ColumnDef,
) -> Result<(), DbErr> {
    if manager.has_column("proxies", column_name).await? {
        return Ok(());
    }

    manager
        .alter_table(
            Table::alter()
                .table(Alias::new("proxies"))
                .add_column(column_def.to_owned())
                .to_owned(),
        )
        .await
}
