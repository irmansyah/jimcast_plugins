use async_trait::async_trait;
use uuid::Uuid;

use crate::entities::{Project, ProjectStatus};
use crate::errors::DomainResult;

#[derive(Debug, Clone, Default)]
pub struct NewProject {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<ProjectStatus>,
}

#[async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn create(&self, project: &Project) -> DomainResult<Project>;
    async fn get_by_id(&self, id: Uuid) -> DomainResult<Option<Project>>;
    async fn list(&self) -> DomainResult<Vec<Project>>;
    async fn update(&self, id: Uuid, changes: UpdateProject) -> DomainResult<Project>;
    async fn delete(&self, id: Uuid) -> DomainResult<()>;
}
