# Workspacekit Component

## Overview

Workspacekit is a critical component in Gitpod that manages the container setup and namespace isolation for workspaces. It serves as the initialization system for workspace containers, setting up the necessary namespaces, mounts, and security configurations to provide a secure and isolated environment for user code execution.

## Purpose

The primary purposes of the Workspacekit component are:
- Initialize and configure workspace containers
- Set up user namespace isolation with proper UID/GID mappings
- Configure mount namespaces and filesystem access
- Establish network namespace isolation
- Implement seccomp filtering for syscall security
- Provide a multi-ring security architecture
- Enable controlled access to host resources
- Support workspace-specific configuration
- Facilitate communication between different security rings

## Architecture

Workspacekit implements a multi-ring security architecture:

1. **Ring0**: The outermost ring that runs with the most privileges, responsible for setting up the container environment
2. **Ring1**: The middle ring that handles namespace setup, mounts, and communication with the workspace daemon
3. **Ring2**: The innermost ring where the actual user code runs, with the most restricted permissions

This ring-based architecture provides defense in depth, ensuring that even if a vulnerability is exploited in the innermost ring, additional security boundaries must be crossed to gain access to the host system.

## Key Components

### Ring0
- Initializes the workspace container
- Communicates with the workspace daemon to prepare for user namespaces
- Creates Ring1 with appropriate namespace isolation
- Handles signals and manages the lifecycle of Ring1

### Ring1
- Sets up UID/GID mappings for user namespace isolation
- Configures mount points and filesystem access
- Establishes network namespace configuration
- Creates and manages Ring2
- Handles seccomp filter setup
- Provides the "lift" service for executing commands in Ring1 from Ring2

### Ring2
- The most restricted environment where user code runs
- Communicates with Ring1 for privileged operations
- Runs the supervisor process that manages the workspace

### Seccomp Filtering
- Implements syscall filtering for security
- Provides a mechanism for controlled access to restricted syscalls
- Handles syscall interception and forwarding to the workspace daemon

## Commands

### ring0
- Entry point for the workspace container
- Prepares the environment for user namespaces
- Launches ring1 with appropriate isolation

### ring1
- Sets up UID/GID mappings
- Configures mount points and filesystem access
- Launches ring2 with additional isolation

### ring2
- Pivots to the new root filesystem
- Loads seccomp filters
- Executes the supervisor process

### lift
- Allows executing commands in ring1 from ring2
- Provides a mechanism for controlled privilege escalation

### nsenter
- Utility for entering namespaces
- Used for debugging and maintenance

## Integration Points

Workspacekit integrates with:
1. **Workspace Daemon**: For operations requiring host privileges
2. **Supervisor**: As the main process running in the workspace
3. **Container Runtime**: For container initialization and lifecycle management
4. **Kubernetes**: For pod configuration and resource management

## Security Considerations

The component implements several security measures:

1. **User Namespace Isolation**: Mapping UIDs/GIDs to provide isolation
2. **Mount Namespace Configuration**: Controlling filesystem access
3. **Network Namespace Isolation**: Restricting network access
4. **Seccomp Filtering**: Limiting available syscalls
5. **Multi-Ring Architecture**: Providing defense in depth
6. **Controlled Privilege Escalation**: Through the lift mechanism

## Configuration

Workspacekit can be configured through environment variables:

- `GITPOD_WORKSPACE_ID`: Workspace identifier
- `WORKSPACEKIT_FSSHIFT`: Filesystem shift method (e.g., SHIFTFS)
- `GITPOD_WORKSPACEKIT_BIND_MOUNTS`: Additional bind mounts
- `WORKSPACEKIT_RING2_ENCLAVE`: Commands to run in the Ring2 namespace
- `GITPOD_WORKSPACEKIT_SUPERVISOR_PATH`: Path to the supervisor binary
- `GITPOD_RLIMIT_CORE`: Core dump size limits
- `GITPOD_WORKSPACEKIT_SLEEP_FOR_DEBUGGING`: Enable debugging sleep

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/content-service-api`: Content service API definitions
- `components/ws-daemon-api`: Workspace daemon API definitions

### External Dependencies
- libseccomp: For seccomp filter implementation
- rootlesskit: For rootless container utilities
- Kubernetes libraries: For pod management

## Common Usage Patterns

Workspacekit is typically used to:
1. Initialize workspace containers with proper isolation
2. Set up filesystem access with appropriate permissions
3. Configure network access for workspaces
4. Implement security boundaries for user code execution
5. Facilitate communication between different security rings

## Related Components

- **Supervisor**: Runs inside the workspace to manage user sessions
- **Workspace Daemon**: Provides host-level operations for workspaces
- **Container Runtime**: Manages the container lifecycle
- **Kubernetes**: Orchestrates workspace pods
