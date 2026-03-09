use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(EngineSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(EngineSessions::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(EngineSessions::ProfileId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(EngineSessions::SessionId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(EngineSessions::Pid).big_integer().null())
                    .col(
                        ColumnDef::new(EngineSessions::StartedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(EngineSessions::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_engine_sessions_profile_id")
                            .from(EngineSessions::Table, EngineSessions::ProfileId)
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uidx_engine_sessions_profile_id")
                    .table(EngineSessions::Table)
                    .col(EngineSessions::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_engine_sessions_pid")
                    .table(EngineSessions::Table)
                    .col(EngineSessions::Pid)
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
                    .table(EngineSessions::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum EngineSessions {
    Table,
    Id,
    ProfileId,
    SessionId,
    Pid,
    StartedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Profiles {
    Table,
    Id,
}
