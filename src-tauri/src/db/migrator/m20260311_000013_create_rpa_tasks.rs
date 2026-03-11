use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(RpaTasks::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaTasks::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(RpaTasks::FlowId).big_integer().not_null())
                    .col(ColumnDef::new(RpaTasks::Name).string().not_null())
                    .col(ColumnDef::new(RpaTasks::RunType).string().not_null())
                    .col(ColumnDef::new(RpaTasks::ExecutionMode).string().not_null())
                    .col(
                        ColumnDef::new(RpaTasks::ConcurrencyLimit)
                            .integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(RpaTasks::CronExpr).text().null())
                    .col(ColumnDef::new(RpaTasks::StartAt).big_integer().null())
                    .col(ColumnDef::new(RpaTasks::Timezone).string().not_null())
                    .col(
                        ColumnDef::new(RpaTasks::Enabled)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(ColumnDef::new(RpaTasks::RuntimeInputJson).text().not_null())
                    .col(ColumnDef::new(RpaTasks::Lifecycle).string().not_null())
                    .col(ColumnDef::new(RpaTasks::DeletedAt).big_integer().null())
                    .col(ColumnDef::new(RpaTasks::LastRunAt).big_integer().null())
                    .col(ColumnDef::new(RpaTasks::NextRunAt).big_integer().null())
                    .col(ColumnDef::new(RpaTasks::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaTasks::UpdatedAt).big_integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_tasks_flow_id")
                            .from(RpaTasks::Table, RpaTasks::FlowId)
                            .to(RpaFlows::Table, RpaFlows::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_tasks_lifecycle")
                    .table(RpaTasks::Table)
                    .col(RpaTasks::Lifecycle)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_tasks_next_run")
                    .table(RpaTasks::Table)
                    .col(RpaTasks::Enabled)
                    .col(RpaTasks::NextRunAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RpaTaskTargets::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaTaskTargets::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(RpaTaskTargets::TaskId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(RpaTaskTargets::ProfileId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(RpaTaskTargets::OrderIndex)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(RpaTaskTargets::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(RpaTaskTargets::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_task_targets_task_id")
                            .from(RpaTaskTargets::Table, RpaTaskTargets::TaskId)
                            .to(RpaTasks::Table, RpaTasks::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_task_targets_profile_id")
                            .from(RpaTaskTargets::Table, RpaTaskTargets::ProfileId)
                            .to(Alias::new("profiles"), Alias::new("id")),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_task_targets_task_order")
                    .table(RpaTaskTargets::Table)
                    .col(RpaTaskTargets::TaskId)
                    .col(RpaTaskTargets::OrderIndex)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_task_targets_task_profile")
                    .table(RpaTaskTargets::Table)
                    .col(RpaTaskTargets::TaskId)
                    .col(RpaTaskTargets::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(RpaRuns::Table)
                    .add_column(ColumnDef::new(RpaRuns::TaskId).big_integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(RpaRuns::Table)
                    .add_column(ColumnDef::new(RpaRuns::TaskName).string().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_runs_task_created")
                    .table(RpaRuns::Table)
                    .col(RpaRuns::TaskId)
                    .col(RpaRuns::CreatedAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_rpa_runs_task_created")
                    .table(RpaRuns::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(RpaRuns::Table)
                    .drop_column(RpaRuns::TaskId)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(RpaRuns::Table)
                    .drop_column(RpaRuns::TaskName)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_rpa_task_targets_task_profile")
                    .table(RpaTaskTargets::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_rpa_task_targets_task_order")
                    .table(RpaTaskTargets::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(RpaTaskTargets::Table).to_owned())
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_rpa_tasks_next_run")
                    .table(RpaTasks::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .if_exists()
                    .name("idx_rpa_tasks_lifecycle")
                    .table(RpaTasks::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(RpaTasks::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum RpaFlows {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum RpaTasks {
    Table,
    Id,
    FlowId,
    Name,
    RunType,
    ExecutionMode,
    ConcurrencyLimit,
    CronExpr,
    StartAt,
    Timezone,
    Enabled,
    RuntimeInputJson,
    Lifecycle,
    DeletedAt,
    LastRunAt,
    NextRunAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum RpaTaskTargets {
    Table,
    Id,
    TaskId,
    ProfileId,
    OrderIndex,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum RpaRuns {
    Table,
    TaskId,
    TaskName,
    CreatedAt,
}
