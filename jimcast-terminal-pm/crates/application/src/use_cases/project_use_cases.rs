use std::sync::Arc;

use domain::{
    CachePort, DomainError, DomainResult, NewProject, Project, ProjectRepository, UpdateProject,
};
use uuid::Uuid;

const PROJECT_LIST_CACHE_KEY: &str = "projects:list";

pub struct ProjectUseCases {
    repo: Arc<dyn ProjectRepository>,
    cache: Arc<dyn CachePort>,
}

impl ProjectUseCases {
    pub fn new(repo: Arc<dyn ProjectRepository>, cache: Arc<dyn CachePort>) -> Self {
        Self { repo, cache }
    }

    pub async fn create_project(&self, input: NewProject) -> DomainResult<Project> {
        if input.name.trim().is_empty() {
            return Err(DomainError::Validation(
                "project name cannot be empty".into(),
            ));
        }
        let project = Project::new(input.name, input.description);
        let created = self.repo.create(&project).await?;
        self.cache.invalidate(PROJECT_LIST_CACHE_KEY).await;
        Ok(created)
    }

    pub async fn get_project(&self, id: Uuid) -> DomainResult<Project> {
        self.repo.get_by_id(id).await?.ok_or(DomainError::NotFound)
    }

    pub async fn list_projects(&self) -> DomainResult<Vec<Project>> {
        // cache-aside: serve from Redis when possible, populate on miss
        if let Some(cached) = self.cache.get(PROJECT_LIST_CACHE_KEY).await {
            if let Ok(projects) = serde_json::from_str::<Vec<Project>>(&cached) {
                return Ok(projects);
            }
        }
        let projects = self.repo.list().await?;
        if let Ok(json) = serde_json::to_string(&projects) {
            self.cache.set(PROJECT_LIST_CACHE_KEY, &json, 30).await;
        }
        Ok(projects)
    }

    pub async fn update_project(&self, id: Uuid, changes: UpdateProject) -> DomainResult<Project> {
        let updated = self.repo.update(id, changes).await?;
        self.cache.invalidate(PROJECT_LIST_CACHE_KEY).await;
        Ok(updated)
    }

    pub async fn delete_project(&self, id: Uuid) -> DomainResult<()> {
        self.repo.delete(id).await?;
        self.cache.invalidate(PROJECT_LIST_CACHE_KEY).await;
        Ok(())
    }
}
