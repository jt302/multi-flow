use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Validation(String),
    Conflict(String),
    Io(std::io::Error),
    Serde(serde_json::Error),
    Database(sea_orm::DbErr),
    Http(reqwest::Error),
}

impl Display for AppError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(message) => write!(f, "not found: {message}"),
            Self::Validation(message) => write!(f, "validation failed: {message}"),
            Self::Conflict(message) => write!(f, "conflict: {message}"),
            Self::Io(err) => write!(f, "io error: {err}"),
            Self::Serde(err) => write!(f, "serialization error: {err}"),
            Self::Database(err) => write!(f, "database error: {err}"),
            Self::Http(err) => write!(f, "http error: {err}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

impl From<sea_orm::DbErr> for AppError {
    fn from(value: sea_orm::DbErr) -> Self {
        Self::Database(value)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(value: reqwest::Error) -> Self {
        Self::Http(value)
    }
}

pub type AppResult<T> = Result<T, AppError>;
