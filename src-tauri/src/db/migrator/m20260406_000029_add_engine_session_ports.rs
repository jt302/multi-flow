use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(EngineSessions::Table)
                    .add_column(ColumnDef::new(EngineSessions::DebugPort).integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(EngineSessions::Table)
                    .add_column(ColumnDef::new(EngineSessions::MagicPort).integer().null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(EngineSessions::Table)
                    .drop_column(EngineSessions::DebugPort)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(EngineSessions::Table)
                    .drop_column(EngineSessions::MagicPort)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum EngineSessions {
    Table,
    DebugPort,
    MagicPort,
}
