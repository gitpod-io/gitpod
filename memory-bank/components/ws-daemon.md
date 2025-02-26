# Workspace Daemon (ws-daemon) Component

## Overview

The Workspace Daemon (ws-daemon) is a critical component that runs on each Kubernetes node in the Gitpod cluster. It manages workspace-related operations at the node level, including workspace initialization, content synchronization, backup, and resource management.

## Purpose

The primary purposes of the Workspace Daemon are:
- Initialize workspace content on the node
- Manage workspace backups and snapshots
- Enforce workspace resource limits (disk space, etc.)
- Monitor workspace health and status
- Provide low-level workspace operations that require node-level access
- Synchronize workspace content with storage backends

## Architecture

The Workspace Daemon operates as a node-level daemon with several key components:

1. **Content Manager**: Handles workspace content initialization and synchronization
2. **Backup System**: Manages periodic backups of workspace content
3. **Resource Controller**: Enforces resource limits and quotas
4. **gRPC API Server**: Provides an API for workspace operations
5. **Health Monitoring**: Monitors workspace and node health

The daemon runs with elevated privileges on each node to perform operations that require system-level access, such as managing LVM volumes, enforcing disk quotas, and accessing workspace filesystems.

## Key Files and Structure

- `main.go`: Entry point that calls the Execute function from the cmd package
- `cmd/root.go`: Defines the root command and basic service configuration
- `cmd/run.go`: Implements the main daemon service
- `cmd/client*.go`: Client commands for interacting with the daemon
- `pkg/daemon/`: Core daemon implementation
- `pkg/content/`: Workspace content management
- `nsinsider/`: Namespace operations helper

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities
- `components/content-service-api/go:lib`: Content service API definitions
- `components/content-service:lib`: Content service client
- `components/ws-daemon-api/go:lib`: Workspace daemon API definitions
- `components/ws-manager-api/go:lib`: Workspace manager API definitions
- `components/ws-manager-mk2:crd`: Workspace manager custom resource definitions

### External Dependencies
- Kubernetes client libraries
- Storage backend libraries (Minio, GCloud)
- System-level libraries for resource management
- gRPC for API communication

## Configuration

The Workspace Daemon is configured via a JSON configuration file that includes:

### Content Configuration
- Working area location
- Backup period
- Workspace size limits
- Storage backend configuration (Minio, GCloud)

### Service Configuration
- API server address
- TLS settings

### Monitoring Configuration
- Prometheus metrics endpoint
- Health check settings

## Integration Points

The Workspace Daemon integrates with:
1. **Workspace Manager**: Receives workspace lifecycle events
2. **Content Service**: For workspace content storage and retrieval
3. **Supervisor**: For workspace-level operations
4. **Storage Backends**: For content backup and synchronization
5. **Kubernetes**: For node and pod information

## Security Considerations

- Runs with elevated privileges on the node
- Manages sensitive workspace content
- Enforces isolation between workspaces
- Handles resource limits and quotas
- Requires secure communication with other components

## Common Usage Patterns

The Workspace Daemon is typically used to:
1. Initialize workspace content when a workspace starts
2. Perform periodic backups of workspace content
3. Enforce disk quotas and resource limits
4. Provide workspace snapshots for persistence
5. Clean up workspace resources when a workspace is deleted

## Resource Management

The Workspace Daemon implements sophisticated resource management:
1. **Disk Quotas**: Enforces workspace disk usage limits
2. **Disk Space Monitoring**: Ensures sufficient disk space is available on the node
3. **LVM Management**: Creates and manages LVM volumes for workspaces (when applicable)

## Related Components

- **Workspace Manager**: Orchestrates workspace lifecycle, interacts with ws-daemon for node-level operations
- **Supervisor**: Runs inside workspace containers, interacts with ws-daemon for content operations
- **Content Service**: Provides storage for workspace content
