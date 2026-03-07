use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::models::{
    now_ts, CreateProfileRequest, ListProfilesResponse, Profile, ProfileLifecycle, ProfileStore,
};

pub struct ProfileService {
    store_path: PathBuf,
    store: ProfileStore,
}

impl ProfileService {
    pub fn from_app_handle(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .or_else(|_| app.path().app_data_dir())
            .map_err(|err| {
                AppError::Validation(format!("failed to resolve app data dir: {err}"))
            })?;
        fs::create_dir_all(&data_dir)?;
        let store_path = data_dir.join("profiles.json");
        let store = if store_path.exists() {
            let content = fs::read_to_string(&store_path)?;
            if content.trim().is_empty() {
                ProfileStore::default()
            } else {
                serde_json::from_str::<ProfileStore>(&content)?
            }
        } else {
            ProfileStore::default()
        };

        Ok(Self { store_path, store })
    }

    pub fn create_profile(&mut self, req: CreateProfileRequest) -> AppResult<Profile> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".to_string()));
        }

        let now = now_ts();
        let profile = Profile {
            id: format!("pf_{:06}", self.store.next_id),
            name: name.to_string(),
            group: req.group.and_then(trim_to_option),
            note: req.note.and_then(trim_to_option),
            lifecycle: ProfileLifecycle::Active,
            running: false,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            last_opened_at: None,
        };

        self.store.next_id += 1;
        self.store.profiles.push(profile.clone());
        self.save()?;
        Ok(profile)
    }

    pub fn list_profiles(&self, include_deleted: bool) -> ListProfilesResponse {
        let mut items: Vec<Profile> = self
            .store
            .profiles
            .iter()
            .filter(|profile| include_deleted || profile.lifecycle == ProfileLifecycle::Active)
            .cloned()
            .collect();
        items.sort_by_key(|profile| profile.created_at);

        ListProfilesResponse {
            total: items.len(),
            items,
        }
    }

    pub fn mark_profile_running(&mut self, profile_id: &str, running: bool) -> AppResult<Profile> {
        let profile = self.find_profile_mut(profile_id)?;
        if profile.lifecycle == ProfileLifecycle::Deleted {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        profile.running = running;
        profile.updated_at = now_ts();
        if running {
            profile.last_opened_at = Some(profile.updated_at);
        }
        let cloned = profile.clone();
        self.save()?;
        Ok(cloned)
    }

    pub fn soft_delete_profile(&mut self, profile_id: &str) -> AppResult<Profile> {
        let profile = self.find_profile_mut(profile_id)?;
        if profile.lifecycle == ProfileLifecycle::Deleted {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        let now = now_ts();
        profile.lifecycle = ProfileLifecycle::Deleted;
        profile.running = false;
        profile.deleted_at = Some(now);
        profile.updated_at = now;
        let cloned = profile.clone();
        self.save()?;
        Ok(cloned)
    }

    pub fn restore_profile(&mut self, profile_id: &str) -> AppResult<Profile> {
        let profile = self.find_profile_mut(profile_id)?;
        if profile.lifecycle == ProfileLifecycle::Active {
            return Err(AppError::Conflict(format!(
                "profile not deleted: {profile_id}"
            )));
        }
        profile.lifecycle = ProfileLifecycle::Active;
        profile.running = false;
        profile.deleted_at = None;
        profile.updated_at = now_ts();
        let cloned = profile.clone();
        self.save()?;
        Ok(cloned)
    }

    pub fn ensure_profile_openable(&self, profile_id: &str) -> AppResult<()> {
        let profile = self.find_profile(profile_id)?;
        if profile.lifecycle == ProfileLifecycle::Deleted {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        if profile.running {
            return Err(AppError::Conflict(format!(
                "profile already running: {profile_id}"
            )));
        }
        Ok(())
    }

    pub fn ensure_profile_closable(&self, profile_id: &str) -> AppResult<()> {
        let profile = self.find_profile(profile_id)?;
        if profile.lifecycle == ProfileLifecycle::Deleted {
            return Err(AppError::Conflict(format!(
                "profile already deleted: {profile_id}"
            )));
        }
        if !profile.running {
            return Err(AppError::Conflict(format!(
                "profile not running: {profile_id}"
            )));
        }
        Ok(())
    }

    fn find_profile(&self, profile_id: &str) -> AppResult<&Profile> {
        self.store
            .profiles
            .iter()
            .find(|profile| profile.id == profile_id)
            .ok_or_else(|| AppError::NotFound(format!("profile not found: {profile_id}")))
    }

    fn find_profile_mut(&mut self, profile_id: &str) -> AppResult<&mut Profile> {
        self.store
            .profiles
            .iter_mut()
            .find(|profile| profile.id == profile_id)
            .ok_or_else(|| AppError::NotFound(format!("profile not found: {profile_id}")))
    }

    fn save(&self) -> AppResult<()> {
        let content = serde_json::to_string_pretty(&self.store)?;
        fs::write(&self.store_path, content)?;
        Ok(())
    }
}

fn trim_to_option(input: String) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}
