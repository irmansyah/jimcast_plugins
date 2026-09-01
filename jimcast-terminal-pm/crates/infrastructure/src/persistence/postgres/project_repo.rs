use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::{DomainError, DomainResult, Project, ProjectRepository, ProjectStatus, UpdateProject};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

pub struct PostgresProjectRepository {
    pool: PgPool,
}

impl PostgresProjectRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct ProjectRow {
    id: Uuid,
    name: String,
    description: Option<String>,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<ProjectRow> for Project {
    fn from(row: ProjectRow) -> Self {
        Project {
            id: row.id,
            name: row.name,
            description: row.description,
            status: ProjectStatus::from_str(&row.status),
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[async_trait]
impl ProjectRepository for PostgresProjectRepository {
    async fn create(&self, project: &Project) -> DomainResult<Project> {
        let row = sqlx::query_as::<_, ProjectRow>(
            r#"INSERT INTO projects (id, name, description, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id, name, description, status, created_at, updated_at"#,
        )
        .bind(project.id)
        .bind(&project.name)
        .bind(&project.description)
        .bind(project.status.as_str())
        .bind(project.created_at)
        .bind(project.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.into())
    }

    async fn get_by_id(&self, id: Uuid) -> DomainResult<Option<Project>> {
        let row = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, description, status, created_at, updated_at FROM projects WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.map(Into::into))
    }

    async fn list(&self) -> DomainResult<Vec<Project>> {
        let rows = sqlx::query_as::<_, ProjectRow>(
            "SELECT id, name, description, status, created_at, updated_at FROM projects ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn update(&self, id: Uuid, changes: UpdateProject) -> DomainResult<Project> {
        let existing = self.get_by_id(id).await?.ok_or(DomainError::NotFound)?;
        let name = changes.name.unwrap_or(existing.name);
        let description = changes.description.or(existing.description);
        let status = changes.status.unwrap_or(existing.status);
        let now = Utc::now();

        let row = sqlx::query_as::<_, ProjectRow>(
            r#"UPDATE projects SET name = $1, description = $2, status = $3, updated_at = $4
               WHERE id = $5
               RETURNING id, name, description, status, created_at, updated_at"#,
        )
        .bind(name)
        .bind(description)
        .bind(status.as_str())
        .bind(now)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(row.into())
    }

    async fn delete(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("DELETE FROM projects WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Repository(e.to_string()))?;
        Ok(())
    }
}
