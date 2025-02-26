# Docker-Up Component

## Overview

The Docker-Up component in Gitpod is responsible for setting up and managing Docker within workspace containers. It provides a way to run Docker in a rootless mode inside Gitpod workspaces, enabling users to build and run containers without requiring privileged access. The component handles the installation, configuration, and startup of Docker daemon and related tools, ensuring they work correctly within the constraints of a workspace environment.

## Purpose

The primary purposes of the Docker-Up component are:
- Enable Docker functionality within Gitpod workspaces
- Provide rootless Docker execution for security
- Automatically install Docker and its dependencies when needed
- Configure Docker daemon with appropriate settings for workspace environments
- Handle network namespace and user namespace setup
- Provide Docker Compose functionality
- Ensure proper permissions for Docker socket access
- Manage container runtime (runc) with appropriate configuration
- Support custom Docker daemon arguments
- Facilitate container port binding through capability management

## Architecture

The Docker-Up component consists of several key parts:

1. **Docker-Up**: The main executable that sets up and starts the Docker daemon
2. **Runc-Facade**: A wrapper around runc (the OCI container runtime) that handles rootless container execution
3. **Dockerd**: Configuration and argument parsing for the Docker daemon
4. **Embedded Binaries**: Docker, Docker Compose, and runc binaries embedded in the component

The component is designed to run as a service within a Gitpod workspace, automatically starting when Docker functionality is requested and configuring the environment appropriately.

## Key Features

### Docker Daemon Management

- Starts and configures the Docker daemon with appropriate settings
- Sets up the Docker socket with proper permissions
- Configures data storage location within the workspace
- Handles MTU configuration based on the container network interface
- Supports custom Docker daemon arguments through environment variables
- Manages Docker daemon lifecycle

### Automatic Installation

- Detects missing prerequisites (Docker, Docker Compose, iptables, etc.)
- Automatically installs required components when needed
- Embeds Docker and Docker Compose binaries for reliable installation
- Ensures correct versions of dependencies are installed
- Handles different Linux distribution package managers

### Rootless Container Execution

- Configures Docker to run in rootless mode for security
- Uses runc-facade to handle rootless container execution
- Manages user namespace mappings
- Configures capabilities for container processes
- Handles OOM score adjustment for container stability

### Network Configuration

- Configures Docker network with appropriate MTU settings
- Handles network namespace setup
- Enables binding to privileged ports (below 1024) without root
- Configures iptables for container networking

## Configuration

The Docker-Up component can be configured through command-line flags and environment variables:

### Command-line Flags
- `--verbose`, `-v`: Enables verbose logging
- `--runc-facade`: Enables the runc-facade to handle rootless idiosyncrasies
- `--bin-dir`: Directory where runc-facade is found
- `--auto-install`: Auto-install prerequisites (Docker)
- `--user-accessible-socket`: Make the Docker socket user accessible
- `--dont-wrap-netns`: Control network namespace wrapping
- `--auto-login`: Use content of GITPOD_IMAGE_AUTH to automatically login with the Docker daemon

### Environment Variables
- `DOCKERD_ARGS`: JSON-formatted custom arguments for the Docker daemon
- `LISTEN_FDS`: Used for socket activation
- `WORKSPACEKIT_WRAP_NETNS`: Controls network namespace wrapping
- `GITPOD_IMAGE_AUTH`: Docker registry authentication information

## Integration Points

The Docker-Up component integrates with:
1. **Workspace Container**: Runs within the workspace container
2. **Supervisor**: Started by the supervisor when Docker functionality is requested
3. **Workspacekit**: Interacts with workspacekit for namespace management
4. **Container Registry**: For pulling and pushing container images
5. **User Code**: Provides Docker CLI and API for user code

## Usage Patterns

### Starting Docker Daemon
```bash
docker-up
```

### Using Custom Docker Daemon Arguments
```bash
DOCKERD_ARGS='{"remap-user":"1000"}' docker-up
```

### Using Docker Compose
```bash
docker-compose up -d
```

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities

### External Dependencies
- Docker daemon
- Docker CLI
- Docker Compose
- runc (OCI container runtime)
- iptables
- uidmap (for user namespace mapping)

## Security Considerations

The component implements several security measures:

1. **Rootless Execution**: Runs Docker without root privileges
2. **User Namespace Mapping**: Isolates container user IDs from host
3. **Capability Management**: Provides minimal required capabilities
4. **Socket Permissions**: Controls access to the Docker socket
5. **OOM Score Adjustment**: Prevents container processes from being killed under memory pressure
6. **Network Isolation**: Configures network namespaces for isolation

## Implementation Details

### Runc-Facade

The runc-facade is a wrapper around the standard runc container runtime that:
- Modifies container configurations for rootless execution
- Adds the CAP_NET_BIND_SERVICE capability to allow binding to privileged ports
- Sets OOM score adjustment to prevent container processes from being killed
- Removes problematic sysctl settings that don't work in rootless mode
- Implements retry logic for container creation to handle timing issues

### Docker Daemon Arguments

The component supports custom Docker daemon arguments through the `DOCKERD_ARGS` environment variable, which accepts a JSON object with configuration options:
- `remap-user`: Configure user namespace remapping
- `proxies`: HTTP/HTTPS proxy settings
- `http-proxy`: HTTP proxy configuration
- `https-proxy`: HTTPS proxy configuration

## Related Components

- **Supervisor**: Manages the lifecycle of Docker-Up
- **Workspacekit**: Provides namespace management
- **Registry-Facade**: Interacts with Docker for image management
- **Image-Builder**: Uses Docker for building workspace images
