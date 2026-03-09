use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Profiles::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Profiles::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Profiles::Name).string().not_null())
                    .col(ColumnDef::new(Profiles::GroupName).string().null())
                    .col(ColumnDef::new(Profiles::Note).string().null())
                    .col(ColumnDef::new(Profiles::Lifecycle).string().not_null())
                    .col(
                        ColumnDef::new(Profiles::Running)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Profiles::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(Profiles::UpdatedAt).big_integer().not_null())
                    .col(ColumnDef::new(Profiles::DeletedAt).big_integer().null())
                    .col(ColumnDef::new(Profiles::LastOpenedAt).big_integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_profiles_lifecycle")
                    .table(Profiles::Table)
                    .col(Profiles::Lifecycle)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Profiles::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Profiles {
    Table,
    Id,
    Name,
    GroupName,
    Note,
    Lifecycle,
    Running,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
    LastOpenedAt,
}
