# Image Builder MK3 Component

## Overview

The Image Builder MK3 is a service that runs in Gitpod clusters and is responsible for building custom workspace images based on user-defined configurations. It provides APIs to create and list workspace image builds, resolve workspace Docker image references, and listen to build updates and logs.

## Purpose

The primary purposes of the Image Builder MK3 are:
- Build custom workspace images based on user-defined Dockerfiles
- Manage the lifecycle of image builds
- Provide APIs for creating and monitoring image builds
- Resolve workspace Docker image references
- Cache frequently used base images
- Stream build logs to clients

## Architecture

The Image Builder MK3 operates as a gRPC service with several key components:

1. **Orchestrator**: Manages the image build process
2. **Reference Resolver**: Resolves Docker image references
3. **Build Manager**: Handles build creation and status tracking
4. **Log Streamer**: Streams build logs to clients
5. **Cache Manager**: Manages caching of frequently used images

The service interacts with the Workspace Manager to coordinate image builds and with container registries to store and retrieve images.

## Key Files and Structure

- `main.go`: Entry point that calls the Execute function from the cmd package
- `cmd/root.go`: Defines the root command and basic service configuration
- `cmd/run.go`: Implements the main service functionality
- `pkg/orchestrator/`: Core orchestration logic for image builds
- `pkg/resolve/`: Image reference resolution

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities
- `components/content-service-api/go:lib`: Content service API definitions
- `components/content-service:lib`: Content service client
- `components/image-builder-api/go:lib`: Image builder API definitions
- `components/supervisor-api/go:lib`: Supervisor API definitions
- `components/ws-manager-api/go:lib`: Workspace manager API definitions
- `components/registry-facade-api/go:lib`: Registry facade API definitions

### External Dependencies
- Docker registry client libraries
- Kubernetes client libraries
- gRPC for service communication
- Prometheus for metrics

## Configuration

The Image Builder MK3 is configured via a JSON configuration file that includes:

### Orchestrator Configuration
- Workspace Manager connection details
- Pull secret for accessing private registries
- Base image repository
- Workspace image repository
- Builder image reference

### Reference Cache Configuration
- Cache interval
- References to cache

### Server Configuration
- gRPC server address and port
- TLS settings

## API Services

The Image Builder MK3 exposes a gRPC API that provides:

1. **BuildImage**: Initiates a new image build
2. **ListBuilds**: Lists existing image builds
3. **BuildStatus**: Retrieves the status of a specific build
4. **BuildLogs**: Streams logs from a build
5. **ResolveWorkspaceImage**: Resolves a workspace image reference

## Build Process

The image build process follows these steps:

1. Client requests an image build via the API
2. Image Builder creates a build record and initiates the build
3. Builder container is created to execute the build
4. Build logs are streamed back to the client
5. Built image is pushed to the configured registry
6. Build status is updated and made available to clients

## Integration Points

The Image Builder MK3 integrates with:
1. **Workspace Manager**: For workspace coordination
2. **Container Registries**: For storing and retrieving images
3. **Kubernetes**: For running builder containers
4. **Content Service**: For accessing workspace content

## Security Considerations

- Handles authentication with private registries
- Requires proper IAM permissions when using cloud-based registries
- Manages sensitive build context and credentials
- Implements proper isolation for build processes

## Common Usage Patterns

The Image Builder MK3 is typically used to:
1. Build custom workspace images from user-defined Dockerfiles
2. Resolve workspace image references for workspace creation
3. Monitor the progress of image builds
4. Stream build logs to users
5. Cache frequently used base images

## Related Components

- **Workspace Manager**: Coordinates with Image Builder for workspace creation
- **Registry Facade**: Serves images built by Image Builder
- **Content Service**: Provides content for image builds
- **Supervisor**: Uses images built by Image Builder
