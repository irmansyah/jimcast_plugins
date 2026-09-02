use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("entity not found")]
    NotFound,
    #[error("validation error: {0}")]
    Validation(String),
    #[error("repository error: {0}")]
    Repository(String),
    #[error("unexpected error: {0}")]
    Unexpected(String),
}

pub type DomainResult<T> = Result<T, DomainError>;
