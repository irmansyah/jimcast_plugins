use axum::{
    extract::{Path, State},
    Json,
};
use domain::{NewTask, TaskPriority, TaskStatus, UpdateTask};
use uuid::Uuid;

use crate::http::{dto::*, error::ApiError, state::AppState};

pub async fn create_task(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<Json<TaskResponse>, ApiError> {
    let task = state
        .task_use_cases
        .create_task(NewTask {
            project_id,
            title: req.title,
            description: req.description,
            priority: req.priority.map(|p| TaskPriority::from_str(&p)),
        })
        .await?;
    Ok(Json(task.into()))
}

pub async fn list_tasks(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<TaskResponse>>, ApiError> {
    let tasks = state.task_use_cases.list_tasks(project_id).await?;
    Ok(Json(tasks.into_iter().map(Into::into).collect()))
}

pub async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TaskResponse>, ApiError> {
    let task = state.task_use_cases.get_task(id).await?;
    Ok(Json(task.into()))
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, ApiError> {
    let changes = UpdateTask {
        title: req.title,
        description: req.description,
        status: req.status.map(|s| TaskStatus::from_str(&s)),
        priority: req.priority.map(|p| TaskPriority::from_str(&p)),
    };
    let task = state.task_use_cases.update_task(id, changes).await?;
    Ok(Json(task.into()))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.task_use_cases.delete_task(id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
