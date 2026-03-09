use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(RpaFlows::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaFlows::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(RpaFlows::Name).string().not_null())
                    .col(ColumnDef::new(RpaFlows::Note).text().null())
                    .col(ColumnDef::new(RpaFlows::DefinitionJson).text().not_null())
                    .col(ColumnDef::new(RpaFlows::DefaultsJson).text().not_null())
                    .col(ColumnDef::new(RpaFlows::Lifecycle).string().not_null())
                    .col(ColumnDef::new(RpaFlows::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaFlows::UpdatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaFlows::DeletedAt).big_integer().null())
                    .col(ColumnDef::new(RpaFlows::LastRunAt).big_integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_flows_lifecycle")
                    .table(RpaFlows::Table)
                    .col(RpaFlows::Lifecycle)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RpaFlowTargets::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaFlowTargets::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(RpaFlowTargets::FlowId).big_integer().not_null())
                    .col(ColumnDef::new(RpaFlowTargets::ProfileId).big_integer().not_null())
                    .col(ColumnDef::new(RpaFlowTargets::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaFlowTargets::UpdatedAt).big_integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_flow_targets_flow_id")
                            .from(RpaFlowTargets::Table, RpaFlowTargets::FlowId)
                            .to(RpaFlows::Table, RpaFlows::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_flow_targets_profile_id")
                            .from(RpaFlowTargets::Table, RpaFlowTargets::ProfileId)
                            .to(Alias::new("profiles"), Alias::new("id")),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_flow_targets_unique")
                    .table(RpaFlowTargets::Table)
                    .col(RpaFlowTargets::FlowId)
                    .col(RpaFlowTargets::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RpaRuns::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaRuns::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(RpaRuns::FlowId).big_integer().not_null())
                    .col(ColumnDef::new(RpaRuns::FlowName).string().not_null())
                    .col(ColumnDef::new(RpaRuns::TriggerSource).string().not_null())
                    .col(ColumnDef::new(RpaRuns::Status).string().not_null())
                    .col(ColumnDef::new(RpaRuns::TotalInstances).integer().not_null())
                    .col(ColumnDef::new(RpaRuns::SuccessCount).integer().not_null())
                    .col(ColumnDef::new(RpaRuns::FailedCount).integer().not_null())
                    .col(ColumnDef::new(RpaRuns::CancelledCount).integer().not_null())
                    .col(ColumnDef::new(RpaRuns::ConcurrencyLimit).integer().not_null())
                    .col(ColumnDef::new(RpaRuns::DefinitionSnapshotJson).text().not_null())
                    .col(ColumnDef::new(RpaRuns::RuntimeInputJson).text().not_null())
                    .col(ColumnDef::new(RpaRuns::StartedAt).big_integer().null())
                    .col(ColumnDef::new(RpaRuns::FinishedAt).big_integer().null())
                    .col(ColumnDef::new(RpaRuns::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaRuns::UpdatedAt).big_integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_runs_flow_id")
                            .from(RpaRuns::Table, RpaRuns::FlowId)
                            .to(RpaFlows::Table, RpaFlows::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_runs_status_created")
                    .table(RpaRuns::Table)
                    .col(RpaRuns::Status)
                    .col(RpaRuns::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RpaRunInstances::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaRunInstances::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(RpaRunInstances::RunId).big_integer().not_null())
                    .col(ColumnDef::new(RpaRunInstances::ProfileId).big_integer().not_null())
                    .col(ColumnDef::new(RpaRunInstances::Status).string().not_null())
                    .col(ColumnDef::new(RpaRunInstances::CurrentNodeId).string().null())
                    .col(ColumnDef::new(RpaRunInstances::ContextJson).text().not_null())
                    .col(ColumnDef::new(RpaRunInstances::ArtifactIndexJson).text().not_null())
                    .col(ColumnDef::new(RpaRunInstances::ErrorMessage).text().null())
                    .col(ColumnDef::new(RpaRunInstances::StartedAt).big_integer().null())
                    .col(ColumnDef::new(RpaRunInstances::FinishedAt).big_integer().null())
                    .col(ColumnDef::new(RpaRunInstances::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaRunInstances::UpdatedAt).big_integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_run_instances_run_id")
                            .from(RpaRunInstances::Table, RpaRunInstances::RunId)
                            .to(RpaRuns::Table, RpaRuns::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_run_instances_profile_id")
                            .from(RpaRunInstances::Table, RpaRunInstances::ProfileId)
                            .to(Alias::new("profiles"), Alias::new("id")),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_run_instances_run_status")
                    .table(RpaRunInstances::Table)
                    .col(RpaRunInstances::RunId)
                    .col(RpaRunInstances::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RpaRunSteps::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RpaRunSteps::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(RpaRunSteps::RunInstanceId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(RpaRunSteps::NodeId).string().not_null())
                    .col(ColumnDef::new(RpaRunSteps::NodeKind).string().not_null())
                    .col(ColumnDef::new(RpaRunSteps::Status).string().not_null())
                    .col(ColumnDef::new(RpaRunSteps::Attempt).integer().not_null())
                    .col(ColumnDef::new(RpaRunSteps::InputSnapshotJson).text().not_null())
                    .col(ColumnDef::new(RpaRunSteps::OutputSnapshotJson).text().not_null())
                    .col(ColumnDef::new(RpaRunSteps::ErrorMessage).text().null())
                    .col(ColumnDef::new(RpaRunSteps::ArtifactIndexJson).text().not_null())
                    .col(ColumnDef::new(RpaRunSteps::StartedAt).big_integer().not_null())
                    .col(ColumnDef::new(RpaRunSteps::FinishedAt).big_integer().null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_rpa_run_steps_instance_id")
                            .from(RpaRunSteps::Table, RpaRunSteps::RunInstanceId)
                            .to(RpaRunInstances::Table, RpaRunInstances::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_rpa_run_steps_instance_started")
                    .table(RpaRunSteps::Table)
                    .col(RpaRunSteps::RunInstanceId)
                    .col(RpaRunSteps::StartedAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().if_exists().table(RpaRunSteps::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaRunInstances::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaRuns::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaFlowTargets::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaFlows::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum RpaFlows {
    Table,
    Id,
    Name,
    Note,
    DefinitionJson,
    DefaultsJson,
    Lifecycle,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
    LastRunAt,
}

#[derive(DeriveIden)]
enum RpaFlowTargets {
    Table,
    Id,
    FlowId,
    ProfileId,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum RpaRuns {
    Table,
    Id,
    FlowId,
    FlowName,
    TriggerSource,
    Status,
    TotalInstances,
    SuccessCount,
    FailedCount,
    CancelledCount,
    ConcurrencyLimit,
    DefinitionSnapshotJson,
    RuntimeInputJson,
    StartedAt,
    FinishedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum RpaRunInstances {
    Table,
    Id,
    RunId,
    ProfileId,
    Status,
    CurrentNodeId,
    ContextJson,
    ArtifactIndexJson,
    ErrorMessage,
    StartedAt,
    FinishedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum RpaRunSteps {
    Table,
    Id,
    RunInstanceId,
    NodeId,
    NodeKind,
    Status,
    Attempt,
    InputSnapshotJson,
    OutputSnapshotJson,
    ErrorMessage,
    ArtifactIndexJson,
    StartedAt,
    FinishedAt,
}
