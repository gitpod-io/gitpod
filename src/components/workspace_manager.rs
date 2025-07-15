use anyhow::Result;
use crate::common::{config::WorkspaceConfig, types::{Workspace, WorkspaceStatus}};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct WorkspaceManager {
    config: WorkspaceConfig,
    workspaces: Arc<RwLock<HashMap<Uuid, Workspace>>>,
}

impl WorkspaceManager {
    pub async fn new(config: &WorkspaceConfig) -> Result<Self> {
        Ok(Self {
            config: config.clone(),
            workspaces: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn create_workspace(&self, user_id: Uuid, name: String) -> Result<Workspace> {
        let workspace = Workspace {
            id: Uuid::new_v4(),
            user_id,
            name,
            image: self.config.default_image.clone(),
            status: WorkspaceStatus::Creating,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        self.workspaces.write().await.insert(workspace.id, workspace.clone());

        // Simulate workspace creation
        let workspace_id = workspace.id;
        let workspaces = self.workspaces.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            if let Some(ws) = workspaces.write().await.get_mut(&workspace_id) {
                ws.status = WorkspaceStatus::Running;
                ws.updated_at = chrono::Utc::now();
            }
        });

        Ok(workspace)
    }

    pub async fn get_workspace(&self, id: Uuid) -> Option<Workspace> {
        self.workspaces.read().await.get(&id).cloned()
    }

    pub async fn list_workspaces(&self, user_id: Uuid) -> Vec<Workspace> {
        self.workspaces
            .read()
            .await
            .values()
            .filter(|ws| ws.user_id == user_id)
            .cloned()
            .collect()
    }

    pub async fn shutdown(&self) -> Result<()> {
        tracing::info!("Shutting down workspace manager");
        Ok(())
    }
}
