// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

use axum::{extract::State, http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: String,
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

#[derive(Serialize, Deserialize)]
pub struct MetricsResponse {
    pub active_workspaces: u64,
    pub total_users: u64,
    pub uptime_seconds: u64,
}

pub async fn metrics(State(state): State<AppState>) -> Result<Json<MetricsResponse>, StatusCode> {
    // Get metrics from database
    let workspaces = state.db.list_workspaces().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let active_workspaces = workspaces.iter().filter(|ws| matches!(ws.status, crate::database::WorkspaceStatus::Running)).count() as u64;

    Ok(Json(MetricsResponse {
        active_workspaces,
        total_users: 0, // TODO: Implement user counting
        uptime_seconds: 0, // TODO: Track uptime
    }))
}
