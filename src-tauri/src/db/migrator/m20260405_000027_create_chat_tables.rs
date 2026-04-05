use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ChatSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ChatSessions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ChatSessions::Title).text())
                    .col(ColumnDef::new(ChatSessions::ProfileId).string())
                    .col(ColumnDef::new(ChatSessions::AiConfigId).string())
                    .col(ColumnDef::new(ChatSessions::SystemPrompt).text())
                    .col(ColumnDef::new(ChatSessions::ToolCategories).text())
                    .col(
                        ColumnDef::new(ChatSessions::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ChatSessions::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ChatMessages::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ChatMessages::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ChatMessages::SessionId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ChatMessages::Role).string().not_null())
                    .col(ColumnDef::new(ChatMessages::ContentText).text())
                    .col(ColumnDef::new(ChatMessages::ContentJson).text())
                    .col(ColumnDef::new(ChatMessages::ToolCallsJson).text())
                    .col(ColumnDef::new(ChatMessages::ToolCallId).string())
                    .col(ColumnDef::new(ChatMessages::ToolName).string())
                    .col(ColumnDef::new(ChatMessages::ToolArgsJson).text())
                    .col(ColumnDef::new(ChatMessages::ToolResult).text())
                    .col(ColumnDef::new(ChatMessages::ToolStatus).string())
                    .col(ColumnDef::new(ChatMessages::ToolDurationMs).big_integer())
                    .col(ColumnDef::new(ChatMessages::ImageBase64).text())
                    .col(ColumnDef::new(ChatMessages::ParentId).string())
                    .col(
                        ColumnDef::new(ChatMessages::IsActive)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(
                        ColumnDef::new(ChatMessages::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ChatMessages::SortOrder)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_chat_messages_session_order")
                    .table(ChatMessages::Table)
                    .col(ChatMessages::SessionId)
                    .col(ChatMessages::SortOrder)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().if_exists().table(ChatMessages::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(ChatSessions::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ChatSessions {
    Table,
    Id,
    Title,
    ProfileId,
    AiConfigId,
    SystemPrompt,
    ToolCategories,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ChatMessages {
    Table,
    Id,
    SessionId,
    Role,
    ContentText,
    ContentJson,
    ToolCallsJson,
    ToolCallId,
    ToolName,
    ToolArgsJson,
    ToolResult,
    ToolStatus,
    ToolDurationMs,
    ImageBase64,
    ParentId,
    IsActive,
    CreatedAt,
    SortOrder,
}
