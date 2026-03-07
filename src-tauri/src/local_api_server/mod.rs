use crate::models::{now_ts, LocalApiServerStatus};

pub struct LocalApiServer {
    bind_address: String,
    running: bool,
    started_at: Option<i64>,
}

impl LocalApiServer {
    pub fn new(bind_address: impl Into<String>) -> Self {
        Self {
            bind_address: bind_address.into(),
            running: false,
            started_at: None,
        }
    }

    pub fn ensure_started(&mut self) {
        if self.running {
            return;
        }
        self.running = true;
        self.started_at = Some(now_ts());
    }

    pub fn status(&self) -> LocalApiServerStatus {
        LocalApiServerStatus {
            running: self.running,
            bind_address: self.bind_address.clone(),
            started_at: self.started_at,
        }
    }
}
