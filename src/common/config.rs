use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub workspace: WorkspaceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub tls_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub max_workspaces: u32,
    pub default_image: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8080,
                tls_enabled: false,
            },
            database: DatabaseConfig {
                url: "postgresql://localhost:5432/gitpod".to_string(),
                max_connections: 10,
            },
            workspace: WorkspaceConfig {
                max_workspaces: 100,
                default_image: "gitpod/workspace-full".to_string(),
            },
        }
    }
}

pub async fn load_config() -> Result<Config> {
    let config_path = std::env::var("GITPOD_CONFIG_PATH")
        .unwrap_or_else(|_| "config.yaml".to_string());

    if Path::new(&config_path).exists() {
        let content = tokio::fs::read_to_string(&config_path).await?;
        let config: Config = serde_yaml::from_str(&content)?;
        Ok(config)
    } else {
        tracing::warn!("Config file not found, using defaults");
        Ok(Config::default())
    }
}
