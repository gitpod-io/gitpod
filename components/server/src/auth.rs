// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

use anyhow::Result;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
}

pub async fn auth_middleware(
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract authorization header
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    // Validate token (simplified)
    let user = validate_token(token).await.map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Add user to request extensions
    request.extensions_mut().insert(user);

    Ok(next.run(request).await)
}

async fn validate_token(token: &str) -> Result<User> {
    // Simplified token validation
    // In production, this would validate JWT tokens, check database, etc.
    if token == "valid-token" {
        Ok(User {
            id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            name: "Test User".to_string(),
        })
    } else {
        Err(anyhow::anyhow!("Invalid token"))
    }
}
