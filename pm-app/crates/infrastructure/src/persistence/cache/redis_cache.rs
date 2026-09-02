use async_trait::async_trait;
use domain::CachePort;
use redis::AsyncCommands;
use redis::Client;

/// Redis-backed implementation of the domain's CachePort. Any connection
/// failure degrades gracefully to a cache miss rather than an error, so
/// Redis being down never takes the API down.
pub struct RedisCache {
    client: Client,
}

impl RedisCache {
    pub fn new(client: Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl CachePort for RedisCache {
    async fn get(&self, key: &str) -> Option<String> {
        let mut conn = self.client.get_multiplexed_async_connection().await.ok()?;
        conn.get::<_, Option<String>>(key).await.ok().flatten()
    }

    async fn set(&self, key: &str, value: &str, ttl_seconds: usize) {
        if let Ok(mut conn) = self.client.get_multiplexed_async_connection().await {
            let _: Result<(), _> = conn.set_ex(key, value, ttl_seconds as u64).await;
        }
    }

    async fn invalidate(&self, key: &str) {
        if let Ok(mut conn) = self.client.get_multiplexed_async_connection().await {
            let _: Result<(), _> = conn.del(key).await;
        }
    }
}
