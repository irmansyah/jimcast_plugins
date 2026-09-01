//! Domain layer: pure business entities, value objects and repository
//! (port) traits. This crate has NO knowledge of Postgres, Redis, HTTP,
//! or the TUI. Everything here is framework-agnostic.

pub mod entities;
pub mod errors;
pub mod repositories;

pub use entities::*;
pub use errors::*;
pub use repositories::*;
