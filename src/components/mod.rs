use anyhow::Result;
use crate::common::config::Config;

pub mod server;
pub mod workspace_manager;
pub mod database;

pub struct Services {
    pub server: server::Server,
    pub workspace_manager: workspace_manager::WorkspaceManager,
    pub database: database::Database,
}

pub async fn start_services(config: &Config) -> Result<Services> {
    let database = database::Database::new(&config.database).await?;
    let workspace_manager = workspace_manager::WorkspaceManager::new(&config.workspace).await?;
    let server = server::Server::new(&config.server, database.clone(), workspace_manager.clone()).await?;

    Ok(Services {
        server,
        workspace_manager,
        database,
    })
}

pub async fn shutdown_services(services: Services) -> Result<()> {
    services.server.shutdown().await?;
    services.workspace_manager.shutdown().await?;
    services.database.shutdown().await?;
    Ok(())
}
