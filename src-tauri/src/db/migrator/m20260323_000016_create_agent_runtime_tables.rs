use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AgentProviderProfiles::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AgentProviderProfiles::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AgentProviderProfiles::Name).string().not_null())
                    .col(
                        ColumnDef::new(AgentProviderProfiles::ProviderKind)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AgentProviderProfiles::BaseUrl).string())
                    .col(ColumnDef::new(AgentProviderProfiles::Model).string().not_null())
                    .col(ColumnDef::new(AgentProviderProfiles::Enabled).boolean().not_null())
                    .col(
                        ColumnDef::new(AgentProviderProfiles::IsDefault)
                            .boolean()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AgentProviderProfiles::SystemPrompt).text())
                    .col(
                        ColumnDef::new(AgentProviderProfiles::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AgentProviderProfiles::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AgentSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AgentSessions::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AgentSessions::Title).string().not_null())
                    .col(
                        ColumnDef::new(AgentSessions::ProviderProfileId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AgentSessions::Model).string().not_null())
                    .col(ColumnDef::new(AgentSessions::RunState).string().not_null())
                    .col(ColumnDef::new(AgentSessions::LatestMessageExcerpt).text())
                    .col(ColumnDef::new(AgentSessions::LastRunId).string())
                    .col(ColumnDef::new(AgentSessions::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(AgentSessions::UpdatedAt).big_integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_agent_sessions_provider_profile")
                            .from(AgentSessions::Table, AgentSessions::ProviderProfileId)
                            .to(AgentProviderProfiles::Table, AgentProviderProfiles::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AgentSessionEvents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AgentSessionEvents::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AgentSessionEvents::SessionId).string().not_null())
                    .col(ColumnDef::new(AgentSessionEvents::RunId).string())
                    .col(ColumnDef::new(AgentSessionEvents::EventType).string().not_null())
                    .col(ColumnDef::new(AgentSessionEvents::Role).string())
                    .col(ColumnDef::new(AgentSessionEvents::Title).string())
                    .col(ColumnDef::new(AgentSessionEvents::Summary).text())
                    .col(ColumnDef::new(AgentSessionEvents::PayloadJson).text())
                    .col(
                        ColumnDef::new(AgentSessionEvents::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_agent_events_session")
                            .from(AgentSessionEvents::Table, AgentSessionEvents::SessionId)
                            .to(AgentSessions::Table, AgentSessions::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(AgentHandoffs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AgentHandoffs::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AgentHandoffs::SessionId).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::RunId).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::ToolName).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::Title).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::Description).text().not_null())
                    .col(ColumnDef::new(AgentHandoffs::Risk).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::Status).string().not_null())
                    .col(ColumnDef::new(AgentHandoffs::PayloadJson).text())
                    .col(ColumnDef::new(AgentHandoffs::ResolutionNote).text())
                    .col(ColumnDef::new(AgentHandoffs::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(AgentHandoffs::ResolvedAt).big_integer())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_agent_handoffs_session")
                            .from(AgentHandoffs::Table, AgentHandoffs::SessionId)
                            .to(AgentSessions::Table, AgentSessions::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_provider_profiles_default")
                    .table(AgentProviderProfiles::Table)
                    .col(AgentProviderProfiles::IsDefault)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_sessions_provider_profile")
                    .table(AgentSessions::Table)
                    .col(AgentSessions::ProviderProfileId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_session_events_session_created")
                    .table(AgentSessionEvents::Table)
                    .col(AgentSessionEvents::SessionId)
                    .col(AgentSessionEvents::CreatedAt)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_agent_handoffs_session_status")
                    .table(AgentHandoffs::Table)
                    .col(AgentHandoffs::SessionId)
                    .col(AgentHandoffs::Status)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().if_exists().table(AgentHandoffs::Table).to_owned())
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(AgentSessionEvents::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().if_exists().table(AgentSessions::Table).to_owned())
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(AgentProviderProfiles::Table)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum AgentProviderProfiles {
    Table,
    Id,
    Name,
    ProviderKind,
    BaseUrl,
    Model,
    Enabled,
    IsDefault,
    SystemPrompt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum AgentSessions {
    Table,
    Id,
    Title,
    ProviderProfileId,
    Model,
    RunState,
    LatestMessageExcerpt,
    LastRunId,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum AgentSessionEvents {
    Table,
    Id,
    SessionId,
    RunId,
    EventType,
    Role,
    Title,
    Summary,
    PayloadJson,
    CreatedAt,
}

#[derive(DeriveIden)]
enum AgentHandoffs {
    Table,
    Id,
    SessionId,
    RunId,
    ToolName,
    Title,
    Description,
    Risk,
    Status,
    PayloadJson,
    ResolutionNote,
    CreatedAt,
    ResolvedAt,
}
