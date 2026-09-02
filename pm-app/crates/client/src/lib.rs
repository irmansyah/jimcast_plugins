//! Thin HTTP client for the pm-backend REST API, shared by every
//! *delivery* front end (TUI, CLI, ...). Deliberately decoupled from the
//! `domain` crate: this speaks the backend's public JSON contract, not
//! Rust's internal domain types, the same way a client in any other
//! language would.

pub mod api_client;
pub mod models;

pub use api_client::ApiClient;
pub use models::*;
