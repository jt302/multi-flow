use sea_orm_migration::prelude::*;

/// 为 automation_scripts 增加 variables_schema_json 列（脚本预定义变量/默认值）
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let _ = db
            .execute_unprepared(
                "ALTER TABLE automation_scripts ADD COLUMN variables_schema_json TEXT",
            )
            .await;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
