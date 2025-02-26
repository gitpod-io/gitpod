# Workspace Proxy (ws-proxy) Component

## Overview

The Workspace Proxy (ws-proxy) is a specialized component in Gitpod that handles routing and proxying of HTTP and WebSocket traffic to workspaces. It acts as an intermediary between the main Gitpod proxy and individual workspace pods, providing workspace-specific routing, port forwarding, and SSH gateway functionality.

## Purpose

The primary purposes of the Workspace Proxy are:
- Route requests to the appropriate workspace pods
- Handle workspace-specific domain routing
- Provide port forwarding functionality for workspace ports
- Implement SSH gateway for direct SSH access to workspaces
- Manage WebSocket connections to workspaces
- Handle workspace-specific routing patterns
- Provide health checks and metrics for workspace connectivity

## Architecture

The Workspace Proxy operates as a specialized proxy service with several key components:

1. **HTTP Proxy**: Routes HTTP requests to workspace pods
2. **WebSocket Proxy**: Handles WebSocket connections to workspaces
3. **SSH Gateway**: Provides SSH access to workspaces
4. **Workspace Info Provider**: Retrieves workspace information from Kubernetes CRDs
5. **Heartbeat Service**: Monitors workspace connectivity
6. **Router**: Determines the appropriate workspace for incoming requests

The component is designed to efficiently route traffic to the correct workspace based on the hostname pattern, handling both HTTP and WebSocket protocols.

## Key Files and Structure

- `main.go`: Entry point that calls the Execute function from the cmd package
- `cmd/root.go`: Defines the root command and basic service configuration
- `cmd/run.go`: Implements the main proxy service
- `pkg/proxy/`: Core proxy implementation
- `pkg/sshproxy/`: SSH gateway implementation
- `pkg/config/`: Configuration handling
- `pkg/analytics/`: Analytics functionality
- `public/`: Static assets for built-in pages

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities
- `components/gitpod-protocol/go:lib`: Gitpod protocol definitions
- `components/content-service-api/go:lib`: Content service API definitions
- `components/content-service:lib`: Content service client
- `components/registry-facade-api/go:lib`: Registry facade API definitions
- `components/supervisor-api/go:lib`: Supervisor API definitions
- `components/ws-manager-api/go:lib`: Workspace manager API definitions
- `components/server/go:lib`: Server component library

### External Dependencies
- Kubernetes client libraries for CRD access
- HTTP and WebSocket libraries
- SSH libraries for SSH gateway
- Prometheus for metrics
- Controller-runtime for Kubernetes integration

## Configuration

The Workspace Proxy is configured via a JSON configuration file that includes:

### Ingress Configuration
- HTTP/HTTPS settings
- Listening address and port
- Host header for routing

### Proxy Configuration
- Transport settings (timeouts, connection limits)
- Gitpod installation details (hostname, workspace domain patterns)
- Workspace pod configuration (ports for IDE and supervisor)
- Built-in pages location

### Workspace Manager Configuration
- Connection details for the Workspace Manager
- TLS settings for secure communication

### SSH Gateway Configuration
- CA key file for SSH certificate signing
- Host keys for SSH server

## Routing Logic

The Workspace Proxy implements sophisticated routing logic:

1. **Workspace Routing**: Routes requests to workspaces based on hostname patterns
2. **Port Forwarding**: Routes requests to specific ports in workspaces
3. **WebSocket Routing**: Handles WebSocket connections to workspaces
4. **SSH Gateway**: Routes SSH connections to workspaces

### Hostname Patterns

The Workspace Proxy handles several hostname patterns:

1. **Standard Workspace**: `<workspace-id>.ws.<region>.<domain>`
2. **Port Forwarding**: `<port>-<workspace-id>.ws.<region>.<domain>`
3. **Debug Workspace**: `debug-<workspace-id>.ws.<region>.<domain>`
4. **Foreign Content**: Special routes for VS Code webviews and webworkers

## SSH Gateway

The Workspace Proxy includes an SSH gateway that allows direct SSH access to workspaces:

- Listens on port 2200 for SSH connections
- Uses host keys for server authentication
- Authenticates users using Gitpod's authentication system
- Routes SSH connections to the appropriate workspace
- Provides heartbeat functionality to monitor workspace connectivity

## Integration Points

The Workspace Proxy integrates with:
1. **Kubernetes API**: Retrieves workspace information from CRDs
2. **Workspace Manager**: Monitors workspace status
3. **Workspace Pods**: Routes traffic to workspace containers
4. **Main Proxy**: Receives traffic from the main Gitpod proxy

## Security Considerations

- Implements secure routing to workspaces
- Handles TLS for secure communication
- Provides SSH gateway with proper authentication
- Validates workspace access permissions
- Implements proper error handling and logging

## Common Usage Patterns

The Workspace Proxy is typically used to:
1. Route HTTP requests to workspace pods
2. Handle WebSocket connections to workspaces
3. Provide port forwarding for workspace services
4. Enable SSH access to workspaces
5. Monitor workspace connectivity

## Related Components

- **Proxy**: Main Gitpod proxy that routes traffic to ws-proxy
- **Workspace Manager**: Manages workspace lifecycle
- **Supervisor**: Runs inside workspace containers
- **Server**: Provides API for workspace operations
