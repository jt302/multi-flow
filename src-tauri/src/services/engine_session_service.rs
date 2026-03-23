use std::future::Future;

use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

use crate::db::entities::engine_session;
use crate::error::{AppError, AppResult};
use crate::models::{now_ts, EngineSession};

pub struct EngineSessionService {
    db: DatabaseConnection,
}

impl EngineSessionService {
    pub fn from_db(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn save_session(&self, profile_id: &str, session: &EngineSession) -> AppResult<()> {
        let profile_pk = parse_profile_id(profile_id)?;
        let now = now_ts();

        if let Some(existing) = self.find_model(profile_pk)? {
            let mut active: engine_session::ActiveModel = existing.into();
            active.session_id = Set(session.session_id as i64);
            active.pid = Set(session.pid.map(i64::from));
            active.started_at = Set(session.started_at);
            active.updated_at = Set(now);
            self.db_query(active.update(&self.db))?;
            return Ok(());
        }

        let model = engine_session::ActiveModel {
            profile_id: Set(profile_pk),
            session_id: Set(session.session_id as i64),
            pid: Set(session.pid.map(i64::from)),
            started_at: Set(session.started_at),
            updated_at: Set(now),
            ..Default::default()
        };
        self.db_query(model.insert(&self.db))?;
        Ok(())
    }

    pub fn get_session(&self, profile_id: &str) -> AppResult<Option<EngineSession>> {
        let profile_pk = parse_profile_id(profile_id)?;
        let stored = self.find_model(profile_pk)?;
        Ok(stored.map(to_engine_session))
    }

    pub fn list_sessions(&self) -> AppResult<Vec<EngineSession>> {
        let models = self.db_query(engine_session::Entity::find().all(&self.db))?;
        Ok(models.into_iter().map(to_engine_session).collect())
    }

    pub fn delete_session(&self, profile_id: &str) -> AppResult<()> {
        let profile_pk = parse_profile_id(profile_id)?;
        if let Some(existing) = self.find_model(profile_pk)? {
            let active: engine_session::ActiveModel = existing.into();
            self.db_query(active.delete(&self.db))?;
        }
        Ok(())
    }

    pub fn clear_all(&self) -> AppResult<usize> {
        let models = self.db_query(engine_session::Entity::find().all(&self.db))?;
        if models.is_empty() {
            return Ok(0);
        }

        let mut count = 0usize;
        for model in models {
            let active: engine_session::ActiveModel = model.into();
            self.db_query(active.delete(&self.db))?;
            count += 1;
        }
        Ok(count)
    }

    fn find_model(&self, profile_pk: i64) -> AppResult<Option<engine_session::Model>> {
        self.db_query(
            engine_session::Entity::find()
                .filter(engine_session::Column::ProfileId.eq(profile_pk))
                .one(&self.db),
        )
    }

    fn db_query<T, F>(&self, future: F) -> AppResult<T>
    where
        F: Future<Output = Result<T, sea_orm::DbErr>>,
    {
        crate::runtime_compat::block_on_compat(future).map_err(AppError::from)
    }
}

fn to_engine_session(model: engine_session::Model) -> EngineSession {
    EngineSession {
        profile_id: format_profile_id(model.profile_id),
        session_id: model.session_id as u64,
        pid: model.pid.and_then(|value| u32::try_from(value).ok()),
        started_at: model.started_at,
    }
}

fn parse_profile_id(profile_id: &str) -> AppResult<i64> {
    let value = profile_id.strip_prefix("pf_").unwrap_or(profile_id);
    value
        .parse::<i64>()
        .map_err(|_| AppError::Validation(format!("invalid profile id: {profile_id}")))
}

fn format_profile_id(id: i64) -> String {
    format!("pf_{id:06}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::CreateProfileRequest;
    use crate::services::profile_service::ProfileService;

    #[test]
    fn save_get_and_delete_session_work() {
        let db = db::init_test_database().expect("init test db");
        let profile_service = ProfileService::from_db(db.clone());
        let service = EngineSessionService::from_db(db);

        let profile = profile_service
            .create_profile(CreateProfileRequest {
                name: "pid-target".to_string(),
                group: None,
                note: None,
                proxy_id: None,
                settings: None,
            })
            .expect("create profile");

        let session = EngineSession {
            profile_id: profile.id.clone(),
            session_id: 9,
            pid: Some(12345),
            started_at: 100,
        };
        service
            .save_session(&profile.id, &session)
            .expect("save session");

        let loaded = service
            .get_session(&profile.id)
            .expect("get session")
            .expect("session exists");
        assert_eq!(loaded.session_id, 9);
        assert_eq!(loaded.pid, Some(12345));
        let sessions = service.list_sessions().expect("list sessions");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].profile_id, profile.id);

        service.delete_session(&profile.id).expect("delete session");
        let deleted = service.get_session(&profile.id).expect("get after delete");
        assert!(deleted.is_none());
    }

    #[test]
    fn save_session_without_profile_fails_by_fk() {
        let db = db::init_test_database().expect("init test db");
        let service = EngineSessionService::from_db(db);
        let session = EngineSession {
            profile_id: "pf_000001".to_string(),
            session_id: 9,
            pid: Some(12345),
            started_at: 100,
        };

        let err = service
            .save_session("pf_000001", &session)
            .expect_err("missing profile should fail by fk");
        assert!(matches!(err, AppError::Database(_)));
    }
}
