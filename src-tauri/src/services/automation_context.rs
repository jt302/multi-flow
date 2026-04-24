use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// 单次脚本运行的上下文，注册到 AppState.active_runs，供 emit helpers 反查。
#[derive(Debug, Clone)]
pub struct ActiveRunCtx {
    pub run_id: String,
    pub profile_id: String,
    pub profile_name: Option<String>,
    #[allow(dead_code)]
    pub script_id: String,
    #[allow(dead_code)]
    pub script_name: Option<String>,
    #[allow(dead_code)]
    pub started_at: i64,
    pub batch_id: Option<String>,
    #[allow(dead_code)]
    pub parent_run_id: Option<String>,
}

impl ActiveRunCtx {
    pub fn new(
        run_id: String,
        profile_id: String,
        profile_name: Option<String>,
        script_id: String,
        script_name: Option<String>,
        batch_id: Option<String>,
        parent_run_id: Option<String>,
    ) -> Arc<Self> {
        let started_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        Arc::new(Self {
            run_id,
            profile_id,
            profile_name,
            script_id,
            script_name,
            started_at,
            batch_id,
            parent_run_id,
        })
    }
}

/// 存储所有活跃运行的上下文表，挂在 AppState 上。
pub struct ActiveRunRegistry {
    inner: Mutex<HashMap<String, Arc<ActiveRunCtx>>>,
}

impl Default for ActiveRunRegistry {
    fn default() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

impl ActiveRunRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, ctx: Arc<ActiveRunCtx>) {
        if let Ok(mut map) = self.inner.lock() {
            map.insert(ctx.run_id.clone(), ctx);
        }
    }

    pub fn unregister(&self, run_id: &str) {
        if let Ok(mut map) = self.inner.lock() {
            map.remove(run_id);
        }
    }

    pub fn get(&self, run_id: &str) -> Option<Arc<ActiveRunCtx>> {
        self.inner
            .lock()
            .ok()
            .and_then(|map| map.get(run_id).cloned())
    }
}

/// RAII guard：drop 时自动从 registry 反注册，防止异常路径漏清理。
pub struct ActiveRunGuard {
    registry: Arc<ActiveRunRegistry>,
    run_id: String,
}

impl ActiveRunGuard {
    pub fn new(registry: Arc<ActiveRunRegistry>, ctx: Arc<ActiveRunCtx>) -> Self {
        registry.register(ctx.clone());
        Self {
            registry,
            run_id: ctx.run_id.clone(),
        }
    }
}

impl Drop for ActiveRunGuard {
    fn drop(&mut self) {
        self.registry.unregister(&self.run_id);
    }
}
