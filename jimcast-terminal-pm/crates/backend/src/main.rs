use std::sync::Arc;

use application::{ProjectUseCases, TaskUseCases};
use infrastructure::http::{routes::build_router, state::AppState};
use infrastructure::persistence::cache::RedisCache;
use infrastructure::persistence::postgres::{PostgresProjectRepository, PostgresTaskRepository};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/pm_app".to_string());
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());

    // --- Composition root: wire infrastructure adapters into application
    // use cases, which are the only thing the HTTP layer talks to. ---

    let pg_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pg_pool).await?;

    let redis_client = redis::Client::open(redis_url)?;

    let project_repo = Arc::new(PostgresProjectRepository::new(pg_pool.clone()));
    let task_repo = Arc::new(PostgresTaskRepository::new(pg_pool.clone()));
    let cache = Arc::new(RedisCache::new(redis_client));

    let project_use_cases = Arc::new(ProjectUseCases::new(project_repo, cache.clone()));
    let task_use_cases = Arc::new(TaskUseCases::new(task_repo, cache));

    let state = AppState {
        project_use_cases,
        task_use_cases,
    };
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("pm-backend listening on {bind_addr}");
    axum::serve(listener, app).await?;

    Ok(())
}
