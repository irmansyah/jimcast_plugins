use axum::{
    extract::{Path, State},
    Json,
};
use domain::{NewProject, ProjectStatus, UpdateProject};
use uuid::Uuid;

use crate::http::{dto::*, error::ApiError, state::AppState};

pub async fn create_project(
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let project = state
        .project_use_cases
        .create_project(NewProject {
            name: req.name,
            description: req.description,
        })
        .await?;
    Ok(Json(project.into()))
}

pub async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectResponse>>, ApiError> {
    let projects = state.project_use_cases.list_projects().await?;
    Ok(Json(projects.into_iter().map(Into::into).collect()))
}

pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let project = state.project_use_cases.get_project(id).await?;
    Ok(Json(project.into()))
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let changes = UpdateProject {
        name: req.name,
        description: req.description,
        status: req.status.map(|s| ProjectStatus::from_str(&s)),
    };
    let project = state.project_use_cases.update_project(id, changes).await?;
    Ok(Json(project.into()))
}

pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.project_use_cases.delete_project(id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
