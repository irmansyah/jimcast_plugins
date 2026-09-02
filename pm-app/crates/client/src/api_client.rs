use anyhow::{Context, Result};
use uuid::Uuid;

use crate::models::*;

#[derive(Clone)]
pub struct ApiClient {
    base_url: String,
    client: reqwest::Client,
}

impl ApiClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            client: reqwest::Client::new(),
        }
    }

    /// Hits the backend's liveness endpoint — used by `mypm health`.
    pub async fn health(&self) -> Result<String> {
        let res = self
            .client
            .get(format!("{}/health", self.base_url))
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.text().await?)
    }

    // ---------------- Projects ----------------

    pub async fn list_projects(&self) -> Result<Vec<ProjectView>> {
        let res = self
            .client
            .get(format!("{}/api/projects", self.base_url))
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn get_project(&self, id: Uuid) -> Result<ProjectView> {
        let res = self
            .client
            .get(format!("{}/api/projects/{}", self.base_url, id))
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn create_project(&self, name: String, description: Option<String>) -> Result<ProjectView> {
        let payload = CreateProjectPayload { name, description };
        let res = self
            .client
            .post(format!("{}/api/projects", self.base_url))
            .json(&payload)
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn update_project(
        &self,
        id: Uuid,
        name: Option<String>,
        description: Option<String>,
        status: Option<String>,
    ) -> Result<ProjectView> {
        let payload = UpdateProjectPayload {
            name,
            description,
            status,
        };
        let res = self
            .client
            .patch(format!("{}/api/projects/{}", self.base_url, id))
            .json(&payload)
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn delete_project(&self, id: Uuid) -> Result<()> {
        self.client
            .delete(format!("{}/api/projects/{}", self.base_url, id))
            .send()
            .await
            .context("request failed")?
            .error_for_status()?;
        Ok(())
    }

    // ---------------- Tasks ----------------

    pub async fn list_tasks(&self, project_id: Uuid) -> Result<Vec<TaskView>> {
        let res = self
            .client
            .get(format!("{}/api/projects/{}/tasks", self.base_url, project_id))
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn get_task(&self, id: Uuid) -> Result<TaskView> {
        let res = self
            .client
            .get(format!("{}/api/tasks/{}", self.base_url, id))
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn create_task(
        &self,
        project_id: Uuid,
        title: String,
        description: Option<String>,
        priority: Option<String>,
    ) -> Result<TaskView> {
        let payload = CreateTaskPayload {
            title,
            description,
            priority,
        };
        let res = self
            .client
            .post(format!("{}/api/projects/{}/tasks", self.base_url, project_id))
            .json(&payload)
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn update_task(
        &self,
        id: Uuid,
        title: Option<String>,
        description: Option<String>,
        status: Option<String>,
        priority: Option<String>,
    ) -> Result<TaskView> {
        let payload = UpdateTaskPayload {
            title,
            description,
            status,
            priority,
        };
        let res = self
            .client
            .patch(format!("{}/api/tasks/{}", self.base_url, id))
            .json(&payload)
            .send()
            .await
            .context("request failed")?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn update_task_status(&self, id: Uuid, status: String) -> Result<TaskView> {
        self.update_task(id, None, None, Some(status), None).await
    }

    pub async fn delete_task(&self, id: Uuid) -> Result<()> {
        self.client
            .delete(format!("{}/api/tasks/{}", self.base_url, id))
            .send()
            .await
            .context("request failed")?
            .error_for_status()?;
        Ok(())
    }
}
