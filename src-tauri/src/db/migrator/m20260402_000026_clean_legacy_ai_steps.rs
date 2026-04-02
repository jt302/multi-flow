use sea_orm_migration::prelude::*;

/// 清理旧的 ai_prompt / ai_extract 步骤数据
/// 删除 steps_json 中包含这些旧步骤类型的脚本
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        // 删除包含已废弃 AI 步骤类型的脚本
        db.execute_unprepared(
            "DELETE FROM automation_scripts WHERE steps_json LIKE '%\"ai_prompt\"%' OR steps_json LIKE '%\"ai_extract\"%'"
        ).await?;
        // 同时清除关联的运行记录
        db.execute_unprepared(
            "DELETE FROM automation_runs WHERE script_id NOT IN (SELECT id FROM automation_scripts)"
        ).await?;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // 不可逆操作
        Ok(())
    }
}
