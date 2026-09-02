use async_trait::async_trait;

/// Abstraction over a cache (e.g. Redis). Defined in the domain layer so
/// that the application layer can depend on the *port*, not on Redis
/// itself. Infrastructure provides the adapter.
#[async_trait]
pub trait CachePort: Send + Sync {
    async fn get(&self, key: &str) -> Option<String>;
    async fn set(&self, key: &str, value: &str, ttl_seconds: usize);
    async fn invalidate(&self, key: &str);
}
