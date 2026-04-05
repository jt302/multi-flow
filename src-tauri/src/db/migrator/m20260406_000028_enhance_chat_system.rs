use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // chat_sessions: 多 Profile 支持
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_sessions"))
                    .add_column(ColumnDef::new(Alias::new("profile_ids")).text())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_sessions"))
                    .add_column(ColumnDef::new(Alias::new("active_profile_id")).text())
                    .to_owned(),
            )
            .await?;

        // 迁移旧数据：将 profile_id 复制到两个新列
        manager
            .get_connection()
            .execute_unprepared(
                "UPDATE chat_sessions SET profile_ids = json_array(profile_id), \
                 active_profile_id = profile_id WHERE profile_id IS NOT NULL",
            )
            .await?;

        // chat_messages: 思考过程 + 图片外部化 + Token 统计 + 压缩标记
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("thinking_text")).text())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("thinking_tokens")).integer())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("image_ref")).text())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("prompt_tokens")).integer())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("completion_tokens")).integer())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("chat_messages"))
                    .add_column(ColumnDef::new(Alias::new("compression_meta")).text())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持 DROP COLUMN，down 留空
        Ok(())
    }
}
