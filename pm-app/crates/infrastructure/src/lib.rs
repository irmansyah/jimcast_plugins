//! Infrastructure layer: adapters that implement domain ports (Postgres
//! repositories, Redis cache) and the HTTP interface (Axum) that drives
//! the application layer. Nothing outside this crate should import sqlx,
//! redis, or axum directly.

pub mod http;
pub mod persistence;
