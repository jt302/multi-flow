use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        add_column_if_missing(manager, "check_status", ColumnDef::new(Alias::new("check_status")).string().null()).await?;
        add_column_if_missing(manager, "check_message", ColumnDef::new(Alias::new("check_message")).string().null()).await?;
        add_column_if_missing(manager, "exit_ip", ColumnDef::new(Alias::new("exit_ip")).string().null()).await?;
        add_column_if_missing(manager, "latitude", ColumnDef::new(Alias::new("latitude")).double().null()).await?;
        add_column_if_missing(manager, "longitude", ColumnDef::new(Alias::new("longitude")).double().null()).await?;
        add_column_if_missing(
            manager,
            "geo_accuracy_meters",
            ColumnDef::new(Alias::new("geo_accuracy_meters")).double().null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "suggested_language",
            ColumnDef::new(Alias::new("suggested_language")).string().null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "suggested_timezone",
            ColumnDef::new(Alias::new("suggested_timezone")).string().null(),
        )
        .await?;
        add_column_if_missing(manager, "expires_at", ColumnDef::new(Alias::new("expires_at")).big_integer().null()).await?;
        Ok(())
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
