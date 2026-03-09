use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ProfileGroups::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ProfileGroups::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ProfileGroups::Name).string().not_null())
                    .col(ColumnDef::new(ProfileGroups::Note).string().null())
                    .col(ColumnDef::new(ProfileGroups::Lifecycle).string().not_null())
                    .col(
                        ColumnDef::new(ProfileGroups::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProfileGroups::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProfileGroups::DeletedAt)
                            .big_integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_profile_groups_lifecycle")
                    .table(ProfileGroups::Table)
                    .col(ProfileGroups::Lifecycle)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_profile_groups_name")
                    .table(ProfileGroups::Table)
                    .col(ProfileGroups::Name)
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
                    .table(ProfileGroups::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum ProfileGroups {
    Table,
    Id,
    Name,
    Note,
    Lifecycle,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
}
