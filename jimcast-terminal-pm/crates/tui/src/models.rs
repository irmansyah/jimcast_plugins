//! Wire-format models for the TUI HTTP client. Deliberately decoupled
//! from the `domain` crate: the TUI is just another delivery mechanism
//! consuming the backend's public JSON contract, not an internal module.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectView {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TaskView {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct CreateProjectPayload {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateTaskPayload {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateTaskPayload {
    pub status: Option<String>,
}
