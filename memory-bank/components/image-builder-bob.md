# Image-Builder-Bob Component

## Overview

The Image-Builder-Bob component in Gitpod is a CLI tool responsible for building and pushing workspace images during workspace startup. It operates within a headless workspace created by the image-builder-mk3 component and handles the building of custom Docker images based on user-defined Dockerfiles in `.gitpod.yml`. The component consists of two main parts: a build process that creates the images and a proxy that handles authentication for pushing the images to registries.

## Purpose

The primary purposes of the Image-Builder-Bob component are:
- Build custom workspace images from user-defined Dockerfiles
- Create base layers for workspace images
- Push built images to container registries
- Handle authentication for private container registries
- Provide a secure way to build images without exposing registry credentials
- Support the workspace prebuild process
- Enable customization of development environments
- Optimize image building with caching
- Facilitate the use of custom Docker configurations in workspaces

## Architecture

The Image-Builder-Bob component consists of several key parts:

1. **Bob Build**: A command that builds the base layer and workspace image
2. **Bob Proxy**: A proxy that authenticates image pushes to registries
3. **Builder Package**: Core functionality for building images
4. **Proxy Package**: Handles registry authentication and proxying
5. **Runc-Facade**: A wrapper for the runc container runtime

The component operates in a headless workspace where:
- `bob proxy` runs in ring1 (started by workspacekit) and receives credentials for pushing images
- `bob build` runs as a workspace task and builds the images, pushing them to `bob proxy`

## Key Features

### Image Building

- **Base Layer Building**: Creates a base image from a custom Dockerfile specified in `.gitpod.yml`
- **Workspace Image Building**: Uses the base layer to create a workspace image
- **Caching**: Reuses previously built base images when available
- **Buildkit Integration**: Uses Buildkit for efficient image building
- **Context Management**: Handles the build context for Docker images
- **Error Handling**: Provides detailed error messages for build failures
- **Logging**: Writes build logs to `/workspace/.gitpod/bob.log`

### Registry Authentication

- **Secure Credential Handling**: Manages registry credentials securely
- **Authentication Proxy**: Proxies and authenticates image pushes
- **Encryption**: Supports encrypted authentication tokens
- **Multiple Registry Support**: Can authenticate with different registries
- **Cloud Provider Integration**: Supports authentication with cloud provider registries (AWS ECR, etc.)

## Configuration

The Image-Builder-Bob component is configured through environment variables:

### Build Configuration
- `BOB_TARGET_REF`: Reference for the target image
- `BOB_BASE_REF`: Reference for the base image
- `BOB_BUILD_BASE`: Whether to build the base image
- `BOB_DOCKERFILE_PATH`: Path to the Dockerfile
- `BOB_CONTEXT_DIR`: Directory to use as build context
- `BOB_EXTERNAL_BUILDKITD`: External Buildkit daemon to use
- `BOB_LOCAL_CACHE_IMPORT`: Local cache import configuration
- `THEIA_WORKSPACE_ROOT`: Workspace root directory

### Authentication Configuration
- `BOB_BASELAYER_AUTH`: Authentication for the base layer registry
- `BOB_WSLAYER_AUTH`: Authentication for the workspace layer registry
- `BOB_AUTH_KEY`: Key for decrypting authentication tokens

### Proxy Configuration
- `WORKSPACEKIT_BOBPROXY_BASEREF`: Base image reference for the proxy
- `WORKSPACEKIT_BOBPROXY_TARGETREF`: Target image reference for the proxy
- `WORKSPACEKIT_BOBPROXY_AUTH`: Authentication for the proxy
- `WORKSPACEKIT_BOBPROXY_ADDITIONALAUTH`: Additional authentication for the proxy

## Usage Patterns

### Building an Image
```bash
BOB_BASE_REF=localhost:5000/source:latest BOB_TARGET_REF=localhost:5000/target:83 bob build
```

### Running the Proxy
```bash
bob proxy --base-ref=localhost:5000/source:latest --target-ref=localhost:5000/target:83 --auth='{"username":"user","password":"pass"}'
```

### Typical Workflow
1. `image-builder-mk3` creates a headless workspace
2. `bob proxy` starts in ring1 with registry credentials
3. `bob build` runs as a workspace task
4. Base layer is built if needed (custom Dockerfile)
5. Workspace image is built using the base layer
6. Images are pushed through `bob proxy` to the registry
7. Workspace starts using the built image

## Integration Points

The Image-Builder-Bob component integrates with:
1. **Image-Builder-MK3**: Creates the headless workspace where Bob runs
2. **Workspacekit**: Starts `bob proxy` in ring1
3. **Registry-Facade**: The built images are later modified by registry-facade
4. **Container Registries**: For pushing and pulling images
5. **Buildkit**: For efficient image building

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities

### External Dependencies
- Buildkit: For building container images
- Docker Registry: For storing built images
- Containerd: For container operations
- OCI Tools: For working with OCI images

## Security Considerations

The component implements several security measures:

1. **Credential Isolation**: Registry credentials are only available to `bob proxy`, not to user code
2. **Encryption**: Authentication tokens can be encrypted
3. **Proxy Authentication**: All image pushes are authenticated through the proxy
4. **Rootless Building**: Images are built without requiring root privileges
5. **Isolated Workspaces**: Building happens in isolated headless workspaces

## Implementation Details

### Build Process

The build process consists of two main steps:
1. **Base Layer Building**: If a custom Dockerfile is specified, a base image is built
2. **Workspace Image Building**: Using crane to copy the image from the base layer

The base layer can be either a previously built custom Dockerfile or a public image. The built images do not include components like `supervisor` or the IDE, as these layers are added by `registry-facade` during image pull.

### Proxy Implementation

The proxy acts as an intermediary between `bob build` and the actual container registry:
1. Receives image pushes from `bob build` on localhost
2. Authenticates with the target registry using provided credentials
3. Forwards the image to the target registry
4. Handles authentication for both base and target images

## Related Components

- **Image-Builder-MK3**: Orchestrates the image building process
- **Registry-Facade**: Adds additional layers to the built images
- **Supervisor**: Manages the workspace environment
- **Workspacekit**: Starts `bob proxy` in ring1
