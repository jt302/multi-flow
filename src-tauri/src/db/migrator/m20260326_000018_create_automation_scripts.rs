use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AutomationScripts::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AutomationScripts::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AutomationScripts::Name).string().not_null())
                    .col(ColumnDef::new(AutomationScripts::Description).text())
                    .col(
                        ColumnDef::new(AutomationScripts::StepsJson)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AutomationScripts::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AutomationScripts::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AutomationRuns::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AutomationRuns::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AutomationRuns::ScriptId).string().not_null())
                    .col(
                        ColumnDef::new(AutomationRuns::ProfileId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AutomationRuns::Status).string().not_null())
                    .col(
                        ColumnDef::new(AutomationRuns::StepsJson)
                            .text()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AutomationRuns::ResultsJson).text())
                    .col(
                        ColumnDef::new(AutomationRuns::StartedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AutomationRuns::FinishedAt).big_integer())
                    .col(ColumnDef::new(AutomationRuns::Error).text())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_automation_runs_script_id")
                    .table(AutomationRuns::Table)
                    .col(AutomationRuns::ScriptId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_automation_runs_profile_id")
                    .table(AutomationRuns::Table)
                    .col(AutomationRuns::ProfileId)
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
                    .table(AutomationRuns::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(AutomationScripts::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum AutomationScripts {
    Table,
    Id,
    Name,
    Description,
    StepsJson,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum AutomationRuns {
    Table,
    Id,
    ScriptId,
    ProfileId,
    Status,
    StepsJson,
    ResultsJson,
    StartedAt,
    FinishedAt,
    Error,
}
