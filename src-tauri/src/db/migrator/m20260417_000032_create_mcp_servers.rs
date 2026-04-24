use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(McpServers::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(McpServers::Id)
                            .text()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(McpServers::Name).text().not_null())
                    .col(ColumnDef::new(McpServers::Transport).text().not_null()) // 'stdio' | 'sse' | 'http'
                    .col(ColumnDef::new(McpServers::Command).text().null())
                    .col(
                        ColumnDef::new(McpServers::ArgsJson)
                            .text()
                            .not_null()
                            .default("[]"),
                    )
                    .col(
                        ColumnDef::new(McpServers::EnvJson)
                            .text()
                            .not_null()
                            .default("{}"),
                    )
                    .col(ColumnDef::new(McpServers::Url).text().null())
                    .col(
                        ColumnDef::new(McpServers::HeadersJson)
                            .text()
                            .not_null()
                            .default("{}"),
                    )
                    .col(
                        ColumnDef::new(McpServers::AuthType)
                            .text()
                            .not_null()
                            .default("none"),
                    ) // 'none' | 'bearer' | 'oauth'
                    .col(ColumnDef::new(McpServers::BearerToken).text().null())
                    .col(ColumnDef::new(McpServers::OauthConfigJson).text().null())
                    .col(ColumnDef::new(McpServers::OauthTokensJson).text().null())
                    .col(
                        ColumnDef::new(McpServers::Enabled)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(McpServers::LastStatus)
                            .text()
                            .not_null()
                            .default("idle"),
                    )
                    .col(ColumnDef::new(McpServers::LastError).text().null())
                    .col(ColumnDef::new(McpServers::CreatedAt).text().not_null())
                    .col(ColumnDef::new(McpServers::UpdatedAt).text().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(McpServers::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum McpServers {
    Table,
    Id,
    Name,
    Transport,
    Command,
    ArgsJson,
    EnvJson,
    Url,
    HeadersJson,
    AuthType,
    BearerToken,
    OauthConfigJson,
    OauthTokensJson,
    Enabled,
    LastStatus,
    LastError,
    CreatedAt,
    UpdatedAt,
}
