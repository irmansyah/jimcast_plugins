use std::sync::Arc;

use application::{ProjectUseCases, TaskUseCases};

/// Axum shared state — the composition root (backend crate) builds this
/// once at startup and injects it into every handler.
#[derive(Clone)]
pub struct AppState {
    pub project_use_cases: Arc<ProjectUseCases>,
    pub task_use_cases: Arc<TaskUseCases>,
}
