use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        add_column_if_missing(
            manager,
            "language_source",
            ColumnDef::new(Alias::new("language_source"))
                .string()
                .null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "custom_language",
            ColumnDef::new(Alias::new("custom_language"))
                .string()
                .null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "effective_language",
            ColumnDef::new(Alias::new("effective_language"))
                .string()
                .null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "timezone_source",
            ColumnDef::new(Alias::new("timezone_source"))
                .string()
                .null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "custom_timezone",
            ColumnDef::new(Alias::new("custom_timezone"))
                .string()
                .null(),
        )
        .await?;
        add_column_if_missing(
            manager,
            "effective_timezone",
            ColumnDef::new(Alias::new("effective_timezone"))
                .string()
                .null(),
        )
        .await?;

        let db = manager.get_connection();
        db.execute_unprepared(
            r#"
            UPDATE proxies
            SET language_source = 'ip'
            WHERE language_source IS NULL OR TRIM(language_source) = '';
            "#,
        )
        .await?;
        db.execute_unprepared(
            r#"
            UPDATE proxies
            SET timezone_source = 'ip'
            WHERE timezone_source IS NULL OR TRIM(timezone_source) = '';
            "#,
        )
        .await?;
        db.execute_unprepared(
            r#"
            UPDATE proxies
            SET effective_language = suggested_language
            WHERE (effective_language IS NULL OR TRIM(effective_language) = '')
              AND language_source = 'ip';
            "#,
        )
        .await?;
        db.execute_unprepared(
            r#"
            UPDATE proxies
            SET effective_timezone = suggested_timezone
            WHERE (effective_timezone IS NULL OR TRIM(effective_timezone) = '')
              AND timezone_source = 'ip';
            "#,
        )
        .await?;
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
