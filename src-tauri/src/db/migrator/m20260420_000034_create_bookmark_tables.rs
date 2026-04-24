use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 创建书签模板表
        manager
            .create_table(
                Table::create()
                    .table(BookmarkTemplates::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(BookmarkTemplates::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(BookmarkTemplates::Name).text().not_null())
                    .col(ColumnDef::new(BookmarkTemplates::Description).text().null())
                    .col(ColumnDef::new(BookmarkTemplates::Tags).text().null())
                    .col(
                        ColumnDef::new(BookmarkTemplates::TreeJson)
                            .text()
                            .not_null()
                            .default(r#"{"roots":{"bookmark_bar":[],"other":[],"mobile":[]}}"#),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplates::Version)
                            .big_integer()
                            .not_null()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplates::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplates::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建订阅表
        manager
            .create_table(
                Table::create()
                    .table(BookmarkTemplateSubscriptions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::TemplateId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::ProfileId)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::SyncMode)
                            .text()
                            .not_null()
                            .default("manual"),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::Strategy)
                            .text()
                            .not_null()
                            .default("mount_as_folder"),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::AppliedVersion)
                            .big_integer()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(BookmarkTemplateSubscriptions::AppliedAt)
                            .big_integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建唯一索引 (template_id, profile_id)
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_bts_template_profile")
                    .table(BookmarkTemplateSubscriptions::Table)
                    .col(BookmarkTemplateSubscriptions::TemplateId)
                    .col(BookmarkTemplateSubscriptions::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(BookmarkTemplateSubscriptions::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().table(BookmarkTemplates::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum BookmarkTemplates {
    Table,
    Id,
    Name,
    Description,
    Tags,
    TreeJson,
    Version,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum BookmarkTemplateSubscriptions {
    Table,
    Id,
    TemplateId,
    ProfileId,
    SyncMode,
    Strategy,
    AppliedVersion,
    AppliedAt,
}
