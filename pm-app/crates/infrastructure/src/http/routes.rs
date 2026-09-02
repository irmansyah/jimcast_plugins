use axum::{routing::get, Router};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use super::handlers::{project_handlers, task_handlers};
use super::state::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route(
            "/api/projects",
            get(project_handlers::list_projects).post(project_handlers::create_project),
        )
        .route(
            "/api/projects/:id",
            get(project_handlers::get_project)
                .patch(project_handlers::update_project)
                .delete(project_handlers::delete_project),
        )
        .route(
            "/api/projects/:project_id/tasks",
            get(task_handlers::list_tasks).post(task_handlers::create_task),
        )
        .route(
            "/api/tasks/:id",
            get(task_handlers::get_task)
                .patch(task_handlers::update_task)
                .delete(task_handlers::delete_task),
        )
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
