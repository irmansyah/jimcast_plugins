//! Application layer: orchestrates use cases against domain repository
//! ports. Contains business workflow logic (validation, caching strategy)
//! but no knowledge of Postgres/Redis/HTTP concretely — only the traits.

pub mod use_cases;

pub use use_cases::*;
