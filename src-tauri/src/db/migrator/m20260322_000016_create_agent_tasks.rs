use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // Compatibility placeholder:
        // some local databases have already recorded this version as applied.
        // Keep the migration name so startup no longer fails with
        // "migration file ... is missing".
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
