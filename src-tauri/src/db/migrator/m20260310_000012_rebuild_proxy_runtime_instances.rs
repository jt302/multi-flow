use sea_orm::Statement;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if !manager.has_table("proxy_runtime_instances").await? {
            return Ok(());
        }

        let db = manager.get_connection();
        let stmt = Statement::from_string(
            manager.get_database_backend(),
            "PRAGMA table_info('proxy_runtime_instances')".to_string(),
        );
        let rows = db.query_all(stmt).await?;
        let columns = rows
            .iter()
            .filter_map(|row| row.try_get::<String>("", "name").ok())
            .collect::<Vec<_>>();

        let required = [
            "profile_id",
            "proxy_id",
            "listen_port",
            "daemon_port",
            "status",
            "last_error",
            "created_at",
            "updated_at",
        ];
        let needs_rebuild = required
            .iter()
            .any(|name| !columns.iter().any(|col| col == name));
        if !needs_rebuild {
            return Ok(());
        }

        manager
            .drop_table(
                Table::drop()
                    .if_exists()
                    .table(ProxyRuntimeInstances::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ProxyRuntimeInstances::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::ProfileId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::ProxyId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::ListenPort)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::DaemonPort)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::Status)
                            .string_len(32)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::LastError)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::CreatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ProxyRuntimeInstances::UpdatedAt)
                            .big_integer()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_proxy_runtime_instances_profile_id")
                            .from(
                                ProxyRuntimeInstances::Table,
                                ProxyRuntimeInstances::ProfileId,
                            )
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_proxy_runtime_instances_proxy_id")
                            .from(ProxyRuntimeInstances::Table, ProxyRuntimeInstances::ProxyId)
                            .to(Proxies::Table, Proxies::Id)
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
                    .name("uidx_proxy_runtime_instances_profile_id")
                    .table(ProxyRuntimeInstances::Table)
                    .col(ProxyRuntimeInstances::ProfileId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("uidx_proxy_runtime_instances_listen_port")
                    .table(ProxyRuntimeInstances::Table)
                    .col(ProxyRuntimeInstances::ListenPort)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_proxy_runtime_instances_proxy_id")
                    .table(ProxyRuntimeInstances::Table)
                    .col(ProxyRuntimeInstances::ProxyId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

#[derive(DeriveIden)]
enum ProxyRuntimeInstances {
    Table,
    Id,
    ProfileId,
    ProxyId,
    ListenPort,
    DaemonPort,
    Status,
    LastError,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Profiles {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Proxies {
    Table,
    Id,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{ConnectionTrait, Database, Statement};

    #[test]
    fn rebuilds_legacy_proxy_runtime_instances_table() {
        tauri::async_runtime::block_on(async {
            let db = Database::connect("sqlite::memory:").await.expect("connect");
            db.execute(Statement::from_string(
                db.get_database_backend(),
                "CREATE TABLE proxy_runtime_instances (id INTEGER PRIMARY KEY AUTOINCREMENT, proxy_id bigint NOT NULL, listen_port integer NOT NULL, status varchar NOT NULL, task_key varchar NULL, started_at bigint NULL, stopped_at bigint NULL, last_error varchar NULL, created_at bigint NOT NULL, updated_at bigint NOT NULL);".to_string(),
            ))
            .await
            .expect("create legacy table");
            let manager = SchemaManager::new(&db);
            Migration.up(&manager).await.expect("run fix migration");
            let rows = db
                .query_all(Statement::from_string(
                    db.get_database_backend(),
                    "PRAGMA table_info('proxy_runtime_instances')".to_string(),
                ))
                .await
                .expect("pragma table info");
            let columns = rows
                .iter()
                .filter_map(|row| row.try_get::<String>("", "name").ok())
                .collect::<Vec<_>>();
            assert!(columns.iter().any(|name| name == "profile_id"));
            assert!(columns.iter().any(|name| name == "daemon_port"));
            assert!(!columns.iter().any(|name| name == "task_key"));
        });
    }
}
