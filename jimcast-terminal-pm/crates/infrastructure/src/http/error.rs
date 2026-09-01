use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use domain::DomainError;
use serde_json::json;

/// Wraps DomainError so it can be returned directly from Axum handlers
/// and mapped to the right HTTP status code.
pub struct ApiError(pub DomainError);

impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self {
        Self(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            DomainError::NotFound => (StatusCode::NOT_FOUND, self.0.to_string()),
            DomainError::Validation(_) => (StatusCode::BAD_REQUEST, self.0.to_string()),
            DomainError::Repository(_) | DomainError::Unexpected(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, self.0.to_string())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
