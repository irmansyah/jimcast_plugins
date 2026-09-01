use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::{DomainError, DomainResult, Task, TaskPriority, TaskRepository, TaskStatus, UpdateTask};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

pub struct PostgresTaskRepository {
    pool: PgPool,
}

impl PostgresTaskRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct TaskRow {
    id: Uuid,
    project_id: Uuid,
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Task {
            id: row.id,
            project_id: row.project_id,
            title: row.title,
            description: row.description,
            status: TaskStatus::from_str(&row.status),
            priority: TaskPriority::from_str(&row.priority),
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[async_trait]
impl TaskRepository for PostgresTaskRepository {
    async fn create(&self, task: &Task) -> DomainResult<Task> {
        let row = sqlx::query_as::<_, TaskRow>(
            r#"INSERT INTO tasks (id, project_id, title, description, status, priority, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id, project_id, title, description, status, priority, created_at, updated_at"#,
        )
        .bind(task.id)
        .bind(task.project_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(task.status.as_str())
        .bind(task.priority.as_str())
        .bind(task.created_at)
        .bind(task.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.into())
    }

    async fn get_by_id(&self, id: Uuid) -> DomainResult<Option<Task>> {
        let row = sqlx::query_as::<_, TaskRow>(
            "SELECT id, project_id, title, description, status, priority, created_at, updated_at FROM tasks WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.map(Into::into))
    }

    async fn list_by_project(&self, project_id: Uuid) -> DomainResult<Vec<Task>> {
        let rows = sqlx::query_as::<_, TaskRow>(
            "SELECT id, project_id, title, description, status, priority, created_at, updated_at FROM tasks WHERE project_id = $1 ORDER BY created_at DESC",
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn update(&self, id: Uuid, changes: UpdateTask) -> DomainResult<Task> {
        let existing = self.get_by_id(id).await?.ok_or(DomainError::NotFound)?;
        let title = changes.title.unwrap_or(existing.title);
        let description = changes.description.or(existing.description);
        let status = changes.status.unwrap_or(existing.status);
        let priority = changes.priority.unwrap_or(existing.priority);
        let now = Utc::now();

        let row = sqlx::query_as::<_, TaskRow>(
            r#"UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4, updated_at = $5
               WHERE id = $6
               RETURNING id, project_id, title, description, status, priority, created_at, updated_at"#,
        )
        .bind(title)
        .bind(description)
        .bind(status.as_str())
        .bind(priority.as_str())
        .bind(now)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.into())
    }

    async fn delete(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("DELETE FROM tasks WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(())
    }
}
