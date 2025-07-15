// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub image: Option<String>,
    pub repository_url: Option<String>,
    pub status: WorkspaceStatus,
    pub url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkspaceStatus {
    Creating,
    Running,
    Stopping,
    Stopped,
    Failed,
}

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self { pool })
    }

    pub async fn create_workspace(
        &self,
        user_id: Uuid,
        name: String,
        image: Option<String>,
        repository_url: Option<String>,
    ) -> Result<Workspace> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let workspace = Workspace {
            id,
            user_id,
            name: name.clone(),
            image: image.clone(),
            repository_url: repository_url.clone(),
            status: WorkspaceStatus::Creating,
            url: None,
            created_at: now,
            updated_at: now,
        };

        sqlx::query!(
            r#"
            INSERT INTO workspaces (id, user_id, name, image, repository_url, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            id,
            user_id,
            name,
            image,
            repository_url,
            "Creating",
            now,
            now
        )
        .execute(&self.pool)
        .await?;

        Ok(workspace)
    }

    pub async fn get_workspace(&self, id: Uuid) -> Result<Option<Workspace>> {
        let row = sqlx::query!(
            "SELECT id, user_id, name, image, repository_url, status, url, created_at, updated_at FROM workspaces WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(Workspace {
                id: row.id,
                user_id: row.user_id,
                name: row.name,
                image: row.image,
                repository_url: row.repository_url,
                status: parse_status(&row.status),
                url: row.url,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn list_workspaces(&self) -> Result<Vec<Workspace>> {
        let rows = sqlx::query!(
            "SELECT id, user_id, name, image, repository_url, status, url, created_at, updated_at FROM workspaces ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let workspaces = rows
            .into_iter()
            .map(|row| Workspace {
                id: row.id,
                user_id: row.user_id,
                name: row.name,
                image: row.image,
                repository_url: row.repository_url,
                status: parse_status(&row.status),
                url: row.url,
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
            .collect();

        Ok(workspaces)
    }

    pub async fn start_workspace(&self, id: Uuid) -> Result<Workspace> {
        let now = Utc::now();
        let url = format!("https://{}.gitpod.example.com", id);

        sqlx::query!(
            "UPDATE workspaces SET status = $1, url = $2, updated_at = $3 WHERE id = $4",
            "Running",
            url,
            now,
            id
        )
        .execute(&self.pool)
        .await?;

        self.get_workspace(id).await?.ok_or_else(|| anyhow::anyhow!("Workspace not found"))
    }

    pub async fn stop_workspace(&self, id: Uuid) -> Result<Workspace> {
        let now = Utc::now();

        sqlx::query!(
            "UPDATE workspaces SET status = $1, url = NULL, updated_at = $2 WHERE id = $3",
            "Stopped",
            now,
            id
        )
        .execute(&self.pool)
        .await?;

        self.get_workspace(id).await?.ok_or_else(|| anyhow::anyhow!("Workspace not found"))
    }
}

fn parse_status(status: &str) -> WorkspaceStatus {
    match status {
        "Creating" => WorkspaceStatus::Creating,
        "Running" => WorkspaceStatus::Running,
        "Stopping" => WorkspaceStatus::Stopping,
        "Stopped" => WorkspaceStatus::Stopped,
        "Failed" => WorkspaceStatus::Failed,
        _ => WorkspaceStatus::Failed,
    }
}
