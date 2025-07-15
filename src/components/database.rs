use anyhow::Result;
use crate::common::{config::DatabaseConfig, types::User};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    config: DatabaseConfig,
    users: Arc<RwLock<HashMap<Uuid, User>>>,
}

impl Database {
    pub async fn new(config: &DatabaseConfig) -> Result<Self> {
        tracing::info!("Connecting to database: {}", config.url);

        Ok(Self {
            config: config.clone(),
            users: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn create_user(&self, email: String, name: String) -> Result<User> {
        let user = User {
            id: Uuid::new_v4(),
            email,
            name,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        self.users.write().await.insert(user.id, user.clone());
        Ok(user)
    }

    pub async fn get_user(&self, id: Uuid) -> Option<User> {
        self.users.read().await.get(&id).cloned()
    }

    pub async fn get_user_by_email(&self, email: &str) -> Option<User> {
        self.users
            .read()
            .await
            .values()
            .find(|user| user.email == email)
            .cloned()
    }

    pub async fn shutdown(&self) -> Result<()> {
        tracing::info!("Closing database connections");
        Ok(())
    }
}
