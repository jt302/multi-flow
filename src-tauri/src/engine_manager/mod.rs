use std::collections::HashMap;

use crate::error::{AppError, AppResult};
use crate::models::{now_ts, EngineSession};

pub struct EngineManager {
    sessions: HashMap<String, EngineSession>,
    next_session_id: u64,
}

impl EngineManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            next_session_id: 1,
        }
    }

    pub fn open_profile(&mut self, profile_id: &str) -> AppResult<EngineSession> {
        if self.sessions.contains_key(profile_id) {
            return Err(AppError::Conflict(format!(
                "profile already running: {profile_id}"
            )));
        }

        let session = EngineSession {
            profile_id: profile_id.to_string(),
            session_id: self.next_session_id,
            started_at: now_ts(),
        };
        self.next_session_id += 1;
        self.sessions
            .insert(profile_id.to_string(), session.clone());

        Ok(session)
    }

    pub fn close_profile(&mut self, profile_id: &str) -> AppResult<EngineSession> {
        self.sessions
            .remove(profile_id)
            .ok_or_else(|| AppError::NotFound(format!("running session not found: {profile_id}")))
    }

    pub fn is_running(&self, profile_id: &str) -> bool {
        self.sessions.contains_key(profile_id)
    }
}
