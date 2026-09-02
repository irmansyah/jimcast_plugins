use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Lifecycle state of a project. Stored as plain TEXT at the persistence
/// boundary so the domain never depends on a specific database's enum type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Planning,
    Active,
    OnHold,
    Completed,
    Archived,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        ProjectStatus::Planning
    }
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectStatus::Planning => "planning",
            ProjectStatus::Active => "active",
            ProjectStatus::OnHold => "on_hold",
            ProjectStatus::Completed => "completed",
            ProjectStatus::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "active" => ProjectStatus::Active,
            "on_hold" => ProjectStatus::OnHold,
            "completed" => ProjectStatus::Completed,
            "archived" => ProjectStatus::Archived,
            _ => ProjectStatus::Planning,
        }
    }
}

/// Core Project entity. This struct is shared, unmodified, across every
/// layer (repositories, use cases, HTTP handlers) — only DTOs at the edges
/// translate to/from it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub status: ProjectStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            status: ProjectStatus::default(),
            created_at: now,
            updated_at: now,
        }
    }
}
