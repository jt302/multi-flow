use sea_orm_migration::prelude::*;

/// 为 automation_scripts 添加 ai_config_id 列（引用 app-preferences 中的 AI 配置项 ID）
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let _ = db
            .execute_unprepared("ALTER TABLE automation_scripts ADD COLUMN ai_config_id TEXT")
            .await;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
