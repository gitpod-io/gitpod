# Workspace Manager MK2 Component

## Overview

The Workspace Manager MK2 (ws-manager-mk2) is a Kubernetes controller responsible for managing the lifecycle of workspaces in Gitpod. It orchestrates the creation, monitoring, and deletion of workspace pods and related resources in the Kubernetes cluster.

## Purpose

The primary purposes of the Workspace Manager MK2 are:
- Manage the complete lifecycle of workspaces in Kubernetes
- Implement workspace timeouts and resource management
- Provide a gRPC API for workspace operations
- Handle workspace status monitoring and updates
- Coordinate with other components like content-service and registry-facade

## Architecture

Workspace Manager MK2 is implemented as a Kubernetes controller using the controller-runtime framework. It consists of several key components:

1. **Workspace Controller**: Manages the Workspace custom resources
2. **Timeout Controller**: Handles workspace timeouts based on configuration
3. **Maintenance Controller**: Manages maintenance mode for workspaces
4. **Subscriber Controller**: Handles workspace event subscriptions
5. **gRPC Service**: Provides API for workspace operations

The component follows the Kubernetes operator pattern, watching for changes to Workspace custom resources and reconciling the actual state with the desired state.

## Key Files and Structure

- `main.go`: Entry point that sets up the controller manager and gRPC service
- `cmd/`: Command-line interface implementation
- `controllers/`: Kubernetes controllers for workspace resources
- `service/`: gRPC service implementation
- `pkg/`: Supporting packages and utilities
- `config/`: Configuration files, including CRD definitions

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities
- `components/content-service-api/go:lib`: Content service API definitions
- `components/content-service:lib`: Content service client
- `components/registry-facade-api/go:lib`: Registry facade API definitions
- `components/ws-manager-api/go:lib`: Workspace manager API definitions
- `components/image-builder-api/go:lib`: Image builder API definitions

### External Dependencies
- Kubernetes client-go: For interacting with the Kubernetes API
- controller-runtime: Framework for building Kubernetes controllers
- gRPC: For service communication
- Prometheus: For metrics and monitoring

## Configuration

Workspace Manager MK2 is configured via a JSON configuration file that includes:

### Manager Configuration
- Namespace settings for workspaces and secrets
- Timeout configurations for different workspace states
- URL templates for workspace access
- TLS configuration for secure communication
- Integration settings for other components

### Content Storage Configuration
- Storage backend configuration (Minio, GCloud)
- Blob quota settings

### RPC Server Configuration
- Address and rate limits for the gRPC server

### Monitoring Configuration
- Prometheus metrics endpoint
- Profiling endpoint

## Integration Points

Workspace Manager MK2 integrates with:
1. **Kubernetes API**: For managing workspace resources
2. **Content Service**: For workspace content management
3. **Registry Facade**: For container image access
4. **Image Builder**: For custom workspace images
5. **WS Daemon**: For workspace runtime operations

## Security Considerations

- Implements TLS for secure gRPC communication
- Manages workspace isolation through Kubernetes
- Handles sensitive workspace configuration
- Enforces resource limits and timeouts
- Uses seccomp profiles for container security

## Common Usage Patterns

Workspace Manager MK2 is typically used to:
1. Create new workspaces based on user requests
2. Monitor workspace status and health
3. Apply timeout policies to workspaces
4. Clean up workspace resources when no longer needed
5. Provide workspace status information to other components

## Metrics and Monitoring

The component exposes Prometheus metrics for:
- Workspace lifecycle operations
- Request handling times
- Resource usage
- Error rates
- Controller reconciliation metrics

## Known Limitations

- Requires specific Kubernetes RBAC permissions
- Operates within a specific namespace, not cluster-wide
- Depends on other Gitpod components for full functionality

## Related Components

- **WS Daemon**: Works with Workspace Manager to manage workspace runtime
- **Content Service**: Manages workspace content
- **Registry Facade**: Provides access to container images
- **Image Builder**: Builds custom workspace images
