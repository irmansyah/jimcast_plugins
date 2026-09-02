use async_trait::async_trait;
use uuid::Uuid;

use crate::entities::{Task, TaskPriority, TaskStatus};
use crate::errors::DomainResult;

#[derive(Debug, Clone, Default)]
pub struct NewTask {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
}

#[derive(Debug, Clone, Default)]
pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<TaskPriority>,
}

#[async_trait]
pub trait TaskRepository: Send + Sync {
    async fn create(&self, task: &Task) -> DomainResult<Task>;
    async fn get_by_id(&self, id: Uuid) -> DomainResult<Option<Task>>;
    async fn list_by_project(&self, project_id: Uuid) -> DomainResult<Vec<Task>>;
    async fn update(&self, id: Uuid, changes: UpdateTask) -> DomainResult<Task>;
    async fn delete(&self, id: Uuid) -> DomainResult<()>;
}
