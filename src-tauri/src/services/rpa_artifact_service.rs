use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

#[derive(Clone)]
pub struct RpaArtifactService {
    root_dir: PathBuf,
}

impl RpaArtifactService {
    pub fn new(root_dir: PathBuf) -> AppResult<Self> {
        fs::create_dir_all(&root_dir)?;
        Ok(Self { root_dir })
    }

    pub fn write_text(
        &self,
        run_id: &str,
        instance_id: &str,
        step_id: &str,
        file_name: &str,
        content: &str,
    ) -> AppResult<String> {
        self.write_bytes(run_id, instance_id, step_id, file_name, content.as_bytes())
    }

    pub fn write_bytes(
        &self,
        run_id: &str,
        instance_id: &str,
        step_id: &str,
        file_name: &str,
        content: &[u8],
    ) -> AppResult<String> {
        let relative = Path::new(run_id)
            .join(instance_id)
            .join(step_id)
            .join(file_name);
        let path = self.root_dir.join(&relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, content)?;
        Ok(relative.to_string_lossy().to_string())
    }

    pub fn root_dir(&self) -> &Path {
        &self.root_dir
    }
}

impl TryFrom<PathBuf> for RpaArtifactService {
    type Error = AppError;

    fn try_from(value: PathBuf) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}
