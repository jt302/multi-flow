use sea_orm_migration::prelude::*;

/// Phase 3：为 automation_scripts 增加 canvas_positions_json 列
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        // 忽略"duplicate column"错误（迁移重跑场景）
        let _ = db
            .execute_unprepared(
                "ALTER TABLE automation_scripts ADD COLUMN canvas_positions_json TEXT",
            )
            .await;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
