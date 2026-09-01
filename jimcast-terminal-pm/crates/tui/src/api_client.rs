use anyhow::Result;
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

    pub async fn list_projects(&self) -> Result<Vec<ProjectView>> {
        let res = self
            .client
            .get(format!("{}/api/projects", self.base_url))
            .send()
            .await?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn create_project(&self, name: String, description: Option<String>) -> Result<ProjectView> {
        let payload = CreateProjectPayload { name, description };
        let res = self
            .client
            .post(format!("{}/api/projects", self.base_url))
            .json(&payload)
            .send()
            .await?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn delete_project(&self, id: Uuid) -> Result<()> {
        self.client
            .delete(format!("{}/api/projects/{}", self.base_url, id))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn list_tasks(&self, project_id: Uuid) -> Result<Vec<TaskView>> {
        let res = self
            .client
            .get(format!("{}/api/projects/{}/tasks", self.base_url, project_id))
            .send()
            .await?;
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
            .await?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn update_task_status(&self, id: Uuid, status: String) -> Result<TaskView> {
        let payload = UpdateTaskPayload { status: Some(status) };
        let res = self
            .client
            .patch(format!("{}/api/tasks/{}", self.base_url, id))
            .json(&payload)
            .send()
            .await?;
        Ok(res.error_for_status()?.json().await?)
    }

    pub async fn delete_task(&self, id: Uuid) -> Result<()> {
        self.client
            .delete(format!("{}/api/tasks/{}", self.base_url, id))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
}
