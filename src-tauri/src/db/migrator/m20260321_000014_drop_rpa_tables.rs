use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(RpaRunSteps::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(RpaRunInstances::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(RpaTaskTargets::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(RpaFlowTargets::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaTasks::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaRuns::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(RpaFlows::Table).to_owned())
            .await?;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

#[derive(DeriveIden)]
enum RpaFlows {
    Table,
}

#[derive(DeriveIden)]
enum RpaFlowTargets {
    Table,
}

#[derive(DeriveIden)]
enum RpaRuns {
    Table,
}

#[derive(DeriveIden)]
enum RpaRunInstances {
    Table,
}

#[derive(DeriveIden)]
enum RpaRunSteps {
    Table,
}

#[derive(DeriveIden)]
enum RpaTasks {
    Table,
}

#[derive(DeriveIden)]
enum RpaTaskTargets {
    Table,
}
