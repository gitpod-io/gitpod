# Registry Facade Component

## Overview

The Registry Facade is a specialized component in Gitpod that acts as an intermediary between the container runtime and container registries. It dynamically modifies container images by adding layers required for Gitpod workspaces, such as the supervisor, IDE, and other tools, without actually modifying the original images.

## Purpose

The primary purposes of the Registry Facade are:
- Intercept container image pulls from the container runtime
- Dynamically add layers to workspace images (supervisor, IDE, tools)
- Provide a unified view of modified images to the container runtime
- Cache image layers for improved performance
- Handle authentication with upstream container registries
- Support various image sources and layer types

## Architecture

The Registry Facade operates as a Docker registry-compatible service with several key components:

1. **Registry Server**: Implements the Docker Registry API to serve modified images
2. **Layer Manager**: Handles the addition of static and dynamic layers to images
3. **Authentication Handler**: Manages authentication with upstream registries
4. **Caching System**: Caches image layers for improved performance
5. **IPFS Integration**: Optional integration with IPFS for distributed layer storage

The component acts as an "image layer smuggler," inserting layers into container images in a specific order to create the complete workspace environment.

## Key Files and Structure

- `main.go`: Entry point that calls the Execute function from the cmd package
- `cmd/root.go`: Defines the root command and basic service configuration
- `cmd/run.go`: Implements the main registry service
- `cmd/setup.go`: Handles service setup and configuration
- `pkg/registry/`: Core registry implementation

## Dependencies

### Internal Dependencies
- `components/common-go:lib`: Common Go utilities
- `components/registry-facade-api/go:lib`: Registry facade API definitions

### External Dependencies
- Docker registry client libraries
- Containerd remote libraries
- Prometheus for metrics
- HTTP libraries for registry communication

## Configuration

The Registry Facade is configured via a JSON configuration file that includes:

### Registry Configuration
- Port for the registry server
- Static layers to add to images
- Storage location for the registry
- Authentication requirements
- IPFS integration settings

### Blobserve Configuration
- Port for the blobserve service
- Repository configurations
- Caching settings
- Pre-pull configurations

### Authentication Configuration
- Docker authentication configuration file path

## Layer Management

The Registry Facade manages several types of layers that are added to workspace images:

1. **Base Image**: The original container image for the workspace
2. **Supervisor**: The Gitpod supervisor component
3. **Workspacekit**: Tools for workspace management
4. **DockerUp**: Docker support in workspaces
5. **IDE**: The IDE (VS Code, JetBrains, etc.)
6. **Desktop IDE**: Desktop versions of IDEs

These layers are added in a specific order to create the complete workspace environment.

## Integration Points

The Registry Facade integrates with:
1. **Container Runtime**: Serves modified images to the container runtime
2. **Workspace Manager**: Consults with workspace manager for layer information
3. **Upstream Registries**: Pulls base images from upstream registries
4. **Blobserve**: Works with blobserve for static content serving
5. **IPFS**: Optional integration for distributed layer storage

## Security Considerations

- Handles authentication with upstream registries
- Manages sensitive Docker credentials
- Requires proper IAM permissions when using cloud-based registries
- Implements proper caching and storage security

## Common Usage Patterns

The Registry Facade is typically used to:
1. Serve workspace images with added layers to the container runtime
2. Cache frequently used layers for improved performance
3. Handle authentication with private registries
4. Provide a unified view of modified images

## Related Components

- **Workspace Manager**: Provides information about required layers
- **Supervisor**: One of the layers added to workspace images
- **Blobserve**: Works with Registry Facade for static content
- **IDE Service**: Provides IDE layers that are added to images
