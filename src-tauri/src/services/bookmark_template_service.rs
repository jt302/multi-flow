use std::future::Future;

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};

use crate::db::entities::{bookmark_template, bookmark_template_subscription};
use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, BookmarkTemplateItem, BookmarkTemplateSubscription, CreateBookmarkTemplateRequest,
    SubscribeTemplateRequest, UpdateBookmarkTemplateRequest,
};

pub struct BookmarkTemplateService {
    db: DatabaseConnection,
}

impl BookmarkTemplateService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // ── 模板 CRUD ────────────────────────────────────────────────────────────

    /// 列出所有模板，按创建时间升序
    pub fn list_templates(&self) -> AppResult<Vec<BookmarkTemplateItem>> {
        let models = self.db_query(
            bookmark_template::Entity::find()
                .order_by_asc(bookmark_template::Column::CreatedAt)
                .all(&self.db),
        )?;
        Ok(models.into_iter().map(to_template_item).collect())
    }

    /// 按 ID 获取单个模板
    pub fn get_template(&self, id: i64) -> AppResult<BookmarkTemplateItem> {
        let model = self
            .db_query(bookmark_template::Entity::find_by_id(id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("bookmark template not found: {id}")))?;
        Ok(to_template_item(model))
    }

    /// 创建新模板
    pub fn create_template(
        &self,
        req: CreateBookmarkTemplateRequest,
    ) -> AppResult<BookmarkTemplateItem> {
        let now = now_ts();
        let active_model = bookmark_template::ActiveModel {
            name: Set(req.name),
            description: Set(req.description),
            tags: Set(req.tags),
            tree_json: Set(req.tree_json),
            version: Set(1),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let result =
            self.db_query(bookmark_template::Entity::insert(active_model).exec(&self.db))?;
        self.get_template(result.last_insert_id)
    }

    /// 更新模板（自动将 version += 1）
    pub fn update_template(
        &self,
        req: UpdateBookmarkTemplateRequest,
    ) -> AppResult<BookmarkTemplateItem> {
        let model = self
            .db_query(bookmark_template::Entity::find_by_id(req.id).one(&self.db))?
            .ok_or_else(|| {
                AppError::NotFound(format!("bookmark template not found: {}", req.id))
            })?;

        let mut active: bookmark_template::ActiveModel = model.into();

        if let Some(name) = req.name {
            active.name = Set(name);
        }
        // description 和 tags 允许显式设为 None
        if req.description.is_some() {
            active.description = Set(req.description);
        }
        if req.tags.is_some() {
            active.tags = Set(req.tags);
        }
        if let Some(tree_json) = req.tree_json {
            active.tree_json = Set(tree_json);
        }

        // 更新版本号
        let current_version = active.version.clone().unwrap();
        active.version = Set(current_version + 1);
        active.updated_at = Set(now_ts());

        let updated = self.db_query(active.update(&self.db))?;
        Ok(to_template_item(updated))
    }

    /// 删除模板，同时删除其所有订阅
    pub fn delete_template(&self, id: i64) -> AppResult<()> {
        // 先删除订阅
        self.db_query(
            bookmark_template_subscription::Entity::delete_many()
                .filter(bookmark_template_subscription::Column::TemplateId.eq(id))
                .exec(&self.db),
        )?;
        // 再删除模板
        let model = self
            .db_query(bookmark_template::Entity::find_by_id(id).one(&self.db))?
            .ok_or_else(|| AppError::NotFound(format!("bookmark template not found: {id}")))?;
        let active: bookmark_template::ActiveModel = model.into();
        self.db_query(active.delete(&self.db))?;
        Ok(())
    }

    // ── 订阅管理 ─────────────────────────────────────────────────────────────

    /// 订阅模板到 profile（已存在则替换）
    pub fn subscribe(&self, req: SubscribeTemplateRequest) -> AppResult<()> {
        // 先删除旧记录（实现 INSERT OR REPLACE 语义）
        self.db_query(
            bookmark_template_subscription::Entity::delete_many()
                .filter(
                    bookmark_template_subscription::Column::TemplateId
                        .eq(req.template_id)
                        .and(
                            bookmark_template_subscription::Column::ProfileId
                                .eq(req.profile_id.clone()),
                        ),
                )
                .exec(&self.db),
        )?;

        let active = bookmark_template_subscription::ActiveModel {
            template_id: Set(req.template_id),
            profile_id: Set(req.profile_id),
            sync_mode: Set(req.sync_mode),
            strategy: Set(req.strategy),
            applied_version: Set(None),
            applied_at: Set(None),
            ..Default::default()
        };
        self.db_query(bookmark_template_subscription::Entity::insert(active).exec(&self.db))?;
        Ok(())
    }

    /// 取消订阅
    pub fn unsubscribe(&self, template_id: i64, profile_id: &str) -> AppResult<()> {
        self.db_query(
            bookmark_template_subscription::Entity::delete_many()
                .filter(
                    bookmark_template_subscription::Column::TemplateId
                        .eq(template_id)
                        .and(bookmark_template_subscription::Column::ProfileId.eq(profile_id)),
                )
                .exec(&self.db),
        )?;
        Ok(())
    }

    /// 列出某模板下所有订阅
    pub fn list_subscriptions(
        &self,
        template_id: i64,
    ) -> AppResult<Vec<BookmarkTemplateSubscription>> {
        let models = self.db_query(
            bookmark_template_subscription::Entity::find()
                .filter(bookmark_template_subscription::Column::TemplateId.eq(template_id))
                .all(&self.db),
        )?;
        Ok(models.into_iter().map(to_subscription).collect())
    }

    /// 列出某 profile 下所有订阅
    pub fn list_profile_subscriptions(
        &self,
        profile_id: &str,
    ) -> AppResult<Vec<BookmarkTemplateSubscription>> {
        let models = self.db_query(
            bookmark_template_subscription::Entity::find()
                .filter(bookmark_template_subscription::Column::ProfileId.eq(profile_id))
                .all(&self.db),
        )?;
        Ok(models.into_iter().map(to_subscription).collect())
    }

    // ── 内部工具 ─────────────────────────────────────────────────────────────

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }
}

// ── 转换辅助函数 ──────────────────────────────────────────────────────────────

fn to_template_item(m: bookmark_template::Model) -> BookmarkTemplateItem {
    BookmarkTemplateItem {
        id: m.id,
        name: m.name,
        description: m.description,
        tags: m.tags,
        tree_json: m.tree_json,
        version: m.version,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }
}

fn to_subscription(m: bookmark_template_subscription::Model) -> BookmarkTemplateSubscription {
    BookmarkTemplateSubscription {
        id: m.id,
        template_id: m.template_id,
        profile_id: m.profile_id,
        sync_mode: m.sync_mode,
        strategy: m.strategy,
        applied_version: m.applied_version,
        applied_at: m.applied_at,
    }
}
