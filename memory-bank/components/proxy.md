# Proxy Component

## Overview

The Proxy is a critical component in Gitpod that serves as the main entry point for all HTTP and WebSocket traffic to the platform. It routes requests to the appropriate backend services, handles TLS termination, enforces security policies, and provides various routing and transformation capabilities for the Gitpod platform.

## Purpose

The primary purposes of the Proxy component are:
- Act as the main ingress point for all Gitpod traffic
- Route requests to appropriate backend services
- Terminate TLS connections
- Enforce security headers and policies
- Handle workspace-specific routing
- Provide WebSocket support
- Implement cross-origin resource sharing (CORS) policies
- Support custom domain routing
- Provide health checks and metrics endpoints

## Architecture

The Proxy is built on Caddy, a powerful, extensible web server with automatic HTTPS capabilities. The Gitpod proxy extends Caddy with custom plugins to handle specific Gitpod requirements:

1. **Core Proxy**: Handles general routing and TLS termination
2. **Workspace Handler**: Routes workspace-specific requests
3. **Custom Plugins**: Extend Caddy with Gitpod-specific functionality
4. **Security Layer**: Enforces security headers and policies
5. **Metrics Endpoint**: Provides monitoring capabilities

## Key Files and Structure

- `Dockerfile`: Builds the proxy container with Caddy and custom plugins
- `conf/Caddyfile`: Main configuration file for the proxy
- `conf/workspace-handler.full`: Configuration for handling workspace requests
- `conf/workspace-handler.meta`: Configuration for handling workspace metadata
- `plugins/`: Custom Caddy plugins for Gitpod-specific functionality

## Custom Plugins

The proxy includes several custom Caddy plugins to extend its functionality:

1. **corsorigin**: Handles Cross-Origin Resource Sharing (CORS) policies
2. **secwebsocketkey**: Validates WebSocket connections
3. **workspacedownload**: Manages workspace content downloads
4. **headlesslogdownload**: Handles headless log downloads
5. **configcat**: Integrates with ConfigCat feature flags
6. **analytics**: Provides analytics functionality
7. **logif**: Conditional logging
8. **jsonselect**: JSON selection for logs
9. **sshtunnel**: SSH tunneling support
10. **frontend_dev**: Development mode for frontend

## Configuration

The proxy is configured via the Caddyfile, which includes:

### Main Domain Configuration
- TLS settings
- Security headers
- Routing rules for the main Gitpod domain
- API endpoints
- Backend service routing

### Workspace Domain Configuration
- Routing for workspace-specific domains
- Port forwarding
- WebSocket handling
- IDE-specific routing

### Security Configuration
- HTTP to HTTPS redirection
- Security headers
- CORS policies
- WebSocket validation

## Routing Logic

The proxy implements sophisticated routing logic:

1. **Main Domain Routing**: Routes requests to the main Gitpod domain to appropriate backend services
2. **Workspace Routing**: Routes workspace requests based on subdomain patterns
3. **API Routing**: Routes API requests to the server component
4. **Public API Routing**: Routes public API requests to the public-api-server
5. **Static Content**: Routes static content requests to appropriate services
6. **WebSocket Routing**: Handles WebSocket connections for real-time communication

## Workspace Routing

Workspace routing is particularly complex, handling several patterns:

1. **Standard Workspace**: `<workspace-id>.ws.<region>.<domain>`
2. **Port Forwarding**: `<port>-<workspace-id>.ws.<region>.<domain>`
3. **Debug Workspace**: `debug-<workspace-id>.ws.<region>.<domain>`
4. **Foreign Content**: Special routes for VS Code webviews and webworkers

## Security Considerations

The proxy implements several security measures:

- TLS termination with secure configuration
- HTTP Strict Transport Security (HSTS)
- Content Security Policy (CSP)
- Cross-Origin Resource Sharing (CORS) policies
- XSS protection
- Referrer policy
- WebSocket validation

## Common Usage Patterns

The Proxy is typically used to:
1. Route client requests to appropriate backend services
2. Provide secure access to workspaces
3. Handle WebSocket connections for real-time communication
4. Enforce security policies
5. Provide health checks and metrics

## Related Components

- **Server**: Receives API requests routed through the proxy
- **Dashboard**: Serves the web UI through the proxy
- **WS Proxy**: Handles workspace-specific traffic
- **IDE Proxy**: Manages IDE-specific routing
- **Public API Server**: Provides public API endpoints
