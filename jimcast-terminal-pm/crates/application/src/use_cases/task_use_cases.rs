use std::sync::Arc;

use domain::{
    CachePort, DomainError, DomainResult, NewTask, Task, TaskPriority, TaskRepository, UpdateTask,
};
use uuid::Uuid;

fn tasks_cache_key(project_id: Uuid) -> String {
    format!("tasks:list:{project_id}")
}

pub struct TaskUseCases {
    repo: Arc<dyn TaskRepository>,
    cache: Arc<dyn CachePort>,
}

impl TaskUseCases {
    pub fn new(repo: Arc<dyn TaskRepository>, cache: Arc<dyn CachePort>) -> Self {
        Self { repo, cache }
    }

    pub async fn create_task(&self, input: NewTask) -> DomainResult<Task> {
        if input.title.trim().is_empty() {
            return Err(DomainError::Validation("task title cannot be empty".into()));
        }
        let project_id = input.project_id;
        let task = Task::new(
            project_id,
            input.title,
            input.description,
            input.priority.unwrap_or(TaskPriority::Medium),
        );
        let created = self.repo.create(&task).await?;
        self.cache.invalidate(&tasks_cache_key(project_id)).await;
        Ok(created)
    }

    pub async fn get_task(&self, id: Uuid) -> DomainResult<Task> {
        self.repo.get_by_id(id).await?.ok_or(DomainError::NotFound)
    }

    pub async fn list_tasks(&self, project_id: Uuid) -> DomainResult<Vec<Task>> {
        let cache_key = tasks_cache_key(project_id);
        if let Some(cached) = self.cache.get(&cache_key).await {
            if let Ok(tasks) = serde_json::from_str::<Vec<Task>>(&cached) {
                return Ok(tasks);
            }
        }
        let tasks = self.repo.list_by_project(project_id).await?;
        if let Ok(json) = serde_json::to_string(&tasks) {
            self.cache.set(&cache_key, &json, 30).await;
        }
        Ok(tasks)
    }

    pub async fn update_task(&self, id: Uuid, changes: UpdateTask) -> DomainResult<Task> {
        let existing = self.repo.get_by_id(id).await?.ok_or(DomainError::NotFound)?;
        let updated = self.repo.update(id, changes).await?;
        self.cache
            .invalidate(&tasks_cache_key(existing.project_id))
            .await;
        Ok(updated)
    }

    pub async fn delete_task(&self, id: Uuid) -> DomainResult<()> {
        let existing = self.repo.get_by_id(id).await?.ok_or(DomainError::NotFound)?;
        self.repo.delete(id).await?;
        self.cache
            .invalidate(&tasks_cache_key(existing.project_id))
            .await;
        Ok(())
    }
}
