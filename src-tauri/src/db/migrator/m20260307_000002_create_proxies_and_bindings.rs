use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Proxies::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Proxies::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Proxies::Name).string().not_null())
                    .col(ColumnDef::new(Proxies::Protocol).string().not_null())
                    .col(ColumnDef::new(Proxies::Host).string().not_null())
                    .col(ColumnDef::new(Proxies::Port).integer().not_null())
                    .col(ColumnDef::new(Proxies::Username).string().null())
                    .col(ColumnDef::new(Proxies::Password).string().null())
                    .col(ColumnDef::new(Proxies::Country).string().null())
                    .col(ColumnDef::new(Proxies::Region).string().null())
                    .col(ColumnDef::new(Proxies::City).string().null())
                    .col(ColumnDef::new(Proxies::Provider).string().null())
                    .col(ColumnDef::new(Proxies::Note).string().null())
                    .col(ColumnDef::new(Proxies::LastStatus).string().null())
                    .col(ColumnDef::new(Proxies::LastCheckedAt).big_integer().null())
                    .col(ColumnDef::new(Proxies::Lifecycle).string().not_null())
                    .col(ColumnDef::new(Proxies::CreatedAt).big_integer().not_null())
                    .col(ColumnDef::new(Proxies::UpdatedAt).big_integer().not_null())
                    .col(ColumnDef::new(Proxies::DeletedAt).big_integer().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_proxies_lifecycle")
                    .table(Proxies::Table)
                    .col(Proxies::Lifecycle)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ProfileProxyBindings::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ProfileProxyBindings::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ProfileProxyBindings::ProfileId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProfileProxyBindings::ProxyId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProfileProxyBindings::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProfileProxyBindings::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_profile_proxy_bindings_profile_id")
                            .from(ProfileProxyBindings::Table, ProfileProxyBindings::ProfileId)
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_profile_proxy_bindings_proxy_id")
                            .from(ProfileProxyBindings::Table, ProfileProxyBindings::ProxyId)
                            .to(Proxies::Table, Proxies::Id)
                            .on_delete(ForeignKeyAction::Restrict)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uidx_profile_proxy_bindings_profile_id")
                    .table(ProfileProxyBindings::Table)
                    .col(ProfileProxyBindings::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_profile_proxy_bindings_proxy_id")
                    .table(ProfileProxyBindings::Table)
                    .col(ProfileProxyBindings::ProxyId)
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
                    .table(ProfileProxyBindings::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().if_exists().table(Proxies::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Proxies {
    Table,
    Id,
    Name,
    Protocol,
    Host,
    Port,
    Username,
    Password,
    Country,
    Region,
    City,
    Provider,
    Note,
    LastStatus,
    LastCheckedAt,
    Lifecycle,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
}

#[derive(DeriveIden)]
enum ProfileProxyBindings {
    Table,
    Id,
    ProfileId,
    ProxyId,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Profiles {
    Table,
    Id,
}
