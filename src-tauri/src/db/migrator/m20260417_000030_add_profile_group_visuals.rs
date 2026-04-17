use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(ProfileGroups::Table)
                    .add_column(
                        ColumnDef::new(ProfileGroups::BrowserBgColor)
                            .string()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(ProfileGroups::Table)
                    .add_column(
                        ColumnDef::new(ProfileGroups::ToolbarLabelMode)
                            .string()
                            .not_null()
                            .default("id_only"),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(ProfileGroups::Table)
                    .drop_column(ProfileGroups::BrowserBgColor)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(ProfileGroups::Table)
                    .drop_column(ProfileGroups::ToolbarLabelMode)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum ProfileGroups {
    Table,
    BrowserBgColor,
    ToolbarLabelMode,
}
