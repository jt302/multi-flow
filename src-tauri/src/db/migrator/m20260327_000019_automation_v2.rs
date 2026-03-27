use sea_orm_migration::prelude::*;

/// Phase 1：为 automation_runs 增加 variables_json 和 cancelled_at 列
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // SQLite 不支持在 ALTER TABLE ADD COLUMN 使用 SchemaManager::alter_table，
        // 直接用原始 SQL，IF NOT EXISTS 语法需要检查列是否存在。
        // SQLite 3.37.0+ 支持 ADD COLUMN IF NOT EXISTS，但为兼容旧版本用异常吞掉。
        for sql in [
            "ALTER TABLE automation_runs ADD COLUMN variables_json TEXT",
            "ALTER TABLE automation_runs ADD COLUMN cancelled_at INTEGER",
        ] {
            // 忽略"duplicate column"错误（迁移重跑场景）
            let _ = db.execute_unprepared(sql).await;
        }

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持 DROP COLUMN（旧版本），跳过回滚
        Ok(())
    }
}
