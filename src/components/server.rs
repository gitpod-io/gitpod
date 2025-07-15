use anyhow::Result;
use crate::common::config::ServerConfig;
use crate::components::{database::Database, workspace_manager::WorkspaceManager};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct Server {
    config: ServerConfig,
    database: Database,
    workspace_manager: WorkspaceManager,
    shutdown_tx: Arc<RwLock<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl Server {
    pub async fn new(
        config: &ServerConfig,
        database: Database,
        workspace_manager: WorkspaceManager,
    ) -> Result<Self> {
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

        let server = Self {
            config: config.clone(),
            database,
            workspace_manager,
            shutdown_tx: Arc::new(RwLock::new(Some(shutdown_tx))),
        };

        // Start HTTP server
        let server_clone = server.clone();
        tokio::spawn(async move {
            server_clone.run(shutdown_rx).await
        });

        Ok(server)
    }

    async fn run(&self, mut shutdown_rx: tokio::sync::oneshot::Receiver<()>) -> Result<()> {
        tracing::info!("Starting HTTP server on {}:{}", self.config.host, self.config.port);

        // Simulate server running
        tokio::select! {
            _ = &mut shutdown_rx => {
                tracing::info!("Server shutdown requested");
            }
        }

        Ok(())
    }

    pub async fn shutdown(&self) -> Result<()> {
        if let Some(tx) = self.shutdown_tx.write().await.take() {
            let _ = tx.send(());
        }
        Ok(())
    }
}
