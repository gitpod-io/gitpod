// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};
use uuid::Uuid;

mod auth;
mod database;
mod handlers;
mod workspace;

#[derive(Clone)]
struct AppState {
    db: Arc<database::Database>,
}

#[derive(Serialize, Deserialize)]
struct CreateWorkspaceRequest {
    name: String,
    image: Option<String>,
    repository_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct WorkspaceResponse {
    id: Uuid,
    name: String,
    status: String,
    url: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    info!("Starting Gitpod server");

    // Initialize database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://localhost:5432/gitpod".to_string());
    let db = Arc::new(database::Database::new(&database_url).await?);

    let state = AppState { db };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/workspaces", get(list_workspaces))
        .route("/api/v1/workspaces", post(create_workspace))
        .route("/api/v1/workspaces/:id", get(get_workspace))
        .route("/api/v1/workspaces/:id/start", post(start_workspace))
        .route("/api/v1/workspaces/:id/stop", post(stop_workspace))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()?;

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("Server listening on port {}", port);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn list_workspaces(State(state): State<AppState>) -> Result<Json<Vec<WorkspaceResponse>>, StatusCode> {
    match state.db.list_workspaces().await {
        Ok(workspaces) => {
            let response: Vec<WorkspaceResponse> = workspaces
                .into_iter()
                .map(|ws| WorkspaceResponse {
                    id: ws.id,
                    name: ws.name,
                    status: format!("{:?}", ws.status),
                    url: ws.url,
                })
                .collect();
            Ok(Json(response))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn create_workspace(
    State(state): State<AppState>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    let user_id = Uuid::new_v4(); // TODO: Get from auth

    match state.db.create_workspace(user_id, req.name, req.image, req.repository_url).await {
        Ok(workspace) => Ok(Json(WorkspaceResponse {
            id: workspace.id,
            name: workspace.name,
            status: format!("{:?}", workspace.status),
            url: workspace.url,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    match state.db.get_workspace(id).await {
        Ok(Some(workspace)) => Ok(Json(WorkspaceResponse {
            id: workspace.id,
            name: workspace.name,
            status: format!("{:?}", workspace.status),
            url: workspace.url,
        })),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn start_workspace(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    match state.db.start_workspace(id).await {
        Ok(workspace) => Ok(Json(WorkspaceResponse {
            id: workspace.id,
            name: workspace.name,
            status: format!("{:?}", workspace.status),
            url: workspace.url,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn stop_workspace(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceResponse>, StatusCode> {
    match state.db.stop_workspace(id).await {
        Ok(workspace) => Ok(Json(WorkspaceResponse {
            id: workspace.id,
            name: workspace.name,
            status: format!("{:?}", workspace.status),
            url: workspace.url,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
