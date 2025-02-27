# Workspace Daemon API

## Overview
The Workspace Daemon API defines the gRPC interfaces for the Workspace Daemon service, which is responsible for managing workspace content, filesystem operations, and low-level container operations within the Gitpod platform. This API enables the initialization, backup, and disposal of workspace content, as well as advanced container operations like user namespace setup and network configuration.

## Purpose
This API provides a standardized interface for:
- Initializing workspace content from various sources
- Creating and managing workspace snapshots and backups
- Configuring user namespaces for workspace containers
- Managing filesystem mounts and network interfaces
- Monitoring workspace resource usage
- Handling workspace teardown and cleanup

## Architecture
The Workspace Daemon API is implemented as a set of gRPC services defined in Protocol Buffer files. These definitions are used to generate client and server code in Go and TypeScript for use by the workspace daemon and other components in the system.

## Key Services

### WorkspaceContentService
Provides methods for managing workspace content:

- `InitWorkspace`: Initializes a new workspace folder in the working area
- `WaitForInit`: Waits until a workspace is fully initialized
- `IsWorkspaceExists`: Checks if ws-daemon knows about a workspace
- `TakeSnapshot`: Creates a backup/snapshot of a workspace
- `DisposeWorkspace`: Cleans up a workspace, possibly after taking a final backup
- `BackupWorkspace`: Creates a backup of a workspace

### InWorkspaceService
Provides methods for low-level container operations:

- `PrepareForUserNS`: Prepares a workspace container for wrapping it in a user namespace
- `WriteIDMapping`: Writes a new user/group ID mapping for user namespaces
- `EvacuateCGroup`: Empties the workspace pod cgroup and produces a new substructure
- `MountProc`: Mounts a masked proc in the container's rootfs
- `UmountProc`: Unmounts a masked proc from the container's rootfs
- `MountSysfs`: Mounts a masked sysfs in the container's rootfs
- `UmountSysfs`: Unmounts a masked sysfs from the container's rootfs
- `MountNfs`: Mounts an NFS share into the container's rootfs
- `UmountNfs`: Unmounts an NFS share from the container's rootfs
- `Teardown`: Prepares workspace content backups and unmounts shiftfs mounts
- `WipingTeardown`: Undoes everything PrepareForUserNS does
- `SetupPairVeths`: Sets up a pair of virtual Ethernet interfaces
- `WorkspaceInfo`: Gets information about the workspace

### WorkspaceInfoService
Provides methods for retrieving workspace information:

- `WorkspaceInfo`: Gets information about the workspace resources

## Key Data Structures

### WorkspaceMetadata
Contains metadata associated with a workspace:
- Owner ID
- Meta ID (workspace ID on the "meta pool" side)

### WorkspaceContentState
Enum defining the state of workspace content:
- `NONE`: No workspace content and no work is underway
- `SETTING_UP`: Workspace content is being produced/checked out/unarchived
- `AVAILABLE`: Workspace content is fully present and ready for use
- `WRAPPING_UP`: Workspace is being torn down

### FSShiftMethod
Enum defining the method for establishing ID shift for user namespaced workspaces:
- `SHIFTFS`: Using shiftfs for ID shifting

### Resources
Contains information about workspace resources:
- CPU usage and limits
- Memory usage and limits

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Requests include workspace IDs to identify the relevant workspace
- Some operations are designed to be called from within the workspace container
- Low-level operations often require process IDs (PIDs) to target specific namespaces

## Dependencies
- Depends on the Content Service API for workspace initialization
- Used by workspace manager to manage workspace lifecycle
- Used by workspacekit for container setup and namespace isolation
- Integrated with Kubernetes for pod management

## Usage Examples
- Workspace creation process uses this API to initialize workspace content
- Snapshot creation uses this API to create backups of workspace content
- Workspace teardown uses this API to clean up resources
- Container setup uses this API to configure user namespaces and mounts

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new workspace management features without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Workspace Daemon API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go and TypeScript needs to be regenerated.

To regenerate the code:

1. Navigate to the ws-daemon-api directory:
   ```bash
   cd components/ws-daemon-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Generates TypeScript code
- Generates mock implementations for testing
- Updates JSON tags in the generated Go code
- Patches the generated TypeScript code for compatibility
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`:

- `install_dependencies`: Installs required protoc plugins
- `go_protoc`: Generates Go code
- `typescript_protoc`: Generates TypeScript code
- `update_license`: Updates license headers in generated files

Additionally, the script:
- Generates mock implementations using `mockgen` for testing
- Updates JSON tags in the generated Go code using `gomodifytags`
- Patches the generated TypeScript code using a script from the content-service-api

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Workspace Daemon API. This typically involves:

1. For Go components:
   ```bash
   cd <component-directory>
   go build ./...
   ```

2. For TypeScript components:
   ```bash
   cd <component-directory>
   yarn install
   yarn build
   ```

3. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Workspace Daemon API is primarily used by the ws-daemon component, which runs on each Kubernetes node and manages workspace content and container operations. It plays a critical role in the workspace lifecycle by handling content initialization, backup, and disposal, as well as advanced container operations.
