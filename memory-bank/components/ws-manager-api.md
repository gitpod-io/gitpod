# Workspace Manager API

## Overview
The Workspace Manager API defines the gRPC interfaces for the Workspace Manager service, which is responsible for managing the lifecycle of workspaces within the Gitpod platform. This API enables the creation, monitoring, and control of workspaces running in Kubernetes clusters.

## Purpose
This API provides a standardized interface for:
- Starting and stopping workspaces
- Monitoring workspace status
- Managing workspace timeouts and activity
- Controlling port exposure and admission settings
- Creating snapshots and backups of workspaces
- Retrieving information about available workspace classes

## Architecture
The Workspace Manager API is implemented as a gRPC service defined in Protocol Buffer files. These definitions are used to generate client and server code in Go and TypeScript for use by the workspace manager and other components in the system.

## Key Services

### WorkspaceManager
Provides methods for managing workspaces:

- `GetWorkspaces`: Retrieves a list of running workspaces and their status
- `StartWorkspace`: Creates a new running workspace within the manager's cluster
- `StopWorkspace`: Stops a running workspace
- `DescribeWorkspace`: Investigates a workspace and returns its status and configuration
- `BackupWorkspace`: Backs up a running workspace
- `Subscribe`: Streams all status updates to a client
- `MarkActive`: Records a workspace as being active, preventing it from timing out
- `SetTimeout`: Changes the default timeout for a running workspace
- `ControlPort`: Publicly exposes or un-exposes a network port for a workspace
- `TakeSnapshot`: Creates a copy of the workspace content for initializing a new workspace
- `ControlAdmission`: Makes a workspace accessible for everyone or for the owner only
- `DeleteVolumeSnapshot`: Deletes a specific volume snapshot
- `UpdateSSHKey`: Updates SSH keys for a workspace
- `DescribeCluster`: Provides information about the cluster

## Key Data Structures

### WorkspaceStatus
Represents the current status of a workspace:
- ID and metadata
- Specification
- Phase (e.g., PENDING, CREATING, INITIALIZING, RUNNING)
- Conditions (detailed state information)
- Runtime information
- Authentication settings
- Initializer metrics

### WorkspacePhase
Enum defining the high-level state of a workspace:
- `UNKNOWN`: Cannot determine the actual phase
- `PENDING`: Workspace is waiting for resources in the cluster
- `CREATING`: Workspace is being created (downloading images)
- `INITIALIZING`: Workspace is executing the initializer
- `RUNNING`: Workspace is actively performing work
- `INTERRUPTED`: Workspace is temporarily unavailable
- `STOPPING`: Workspace is shutting down
- `STOPPED`: Workspace has ended regularly

### WorkspaceSpec
Defines the runtime configuration of a workspace:
- Workspace image
- IDE image and layers
- Exposed ports
- Timeout settings
- Workspace class

### StartWorkspaceSpec
Defines the configuration for starting a workspace:
- Workspace image
- IDE image and layers
- Feature flags
- Initializer configuration
- Ports to expose
- Environment variables
- Git configuration
- Timeout settings
- Admission level
- SSH public keys

### PortSpec
Describes a networking port exposed on a workspace:
- Port number
- Visibility (private or public)
- URL
- Protocol (HTTP or HTTPS)

### WorkspaceClass
Describes a workspace class supported by the cluster:
- ID
- Display name
- Description
- Credits per minute

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- The `Subscribe` method uses server-side streaming to provide real-time updates
- Requests include workspace IDs to identify the relevant workspace
- Filtering can be applied using metadata to target specific workspaces

## Dependencies
- Depends on the Content Service API for workspace initialization
- Used by the server component for workspace management
- Used by the ws-manager-bridge to communicate with workspace managers
- Integrated with Kubernetes for cluster management

## Usage Examples
- Workspace creation process uses this API to start new workspaces
- Monitoring systems use this API to track workspace status
- Billing systems use this API to track workspace activity
- Administrative tools use this API to manage workspaces

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new workspace management features without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Workspace Manager API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go and TypeScript needs to be regenerated.

To regenerate the code:

1. Navigate to the ws-manager-api directory:
   ```bash
   cd components/ws-manager-api
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
- Patches the generated TypeScript code using a script from the content-service-api

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Workspace Manager API. This typically involves:

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

The Workspace Manager API is primarily used by the ws-manager-mk2 component, which is a Kubernetes controller for managing workspace lifecycle. It plays a critical role in the platform by enabling the creation, monitoring, and control of workspaces running in Kubernetes clusters.
