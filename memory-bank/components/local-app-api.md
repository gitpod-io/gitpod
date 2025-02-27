# Local App API

## Overview
The Local App API defines the gRPC interfaces for the Local App service, which facilitates communication between a user's local machine and Gitpod workspaces. This API enables port tunneling, SSH connection management, and other local-to-remote interactions.

## Purpose
This API provides a standardized interface for:
- Monitoring and managing port tunnels between local machines and remote workspaces
- Enabling automatic port tunneling for seamless local-to-remote communication
- Resolving SSH connection details for connecting to workspaces via SSH

## Architecture
The Local App API is implemented as a gRPC service defined in Protocol Buffer files. These definitions are used to generate client and server code in Go for use by the local app and other components in the system.

## Key Services

### LocalApp
Provides methods for managing local-to-remote communication:

- `TunnelStatus`: Streams the status of port tunnels for a workspace instance
- `AutoTunnel`: Enables or disables automatic port tunneling for a workspace instance
- `ResolveSSHConnection`: Resolves SSH connection details for connecting to a workspace

## Key Data Structures

### TunnelStatus
Represents the status of a port tunnel:
- Remote port number
- Local port number
- Visibility setting (public, private, etc.)

### ResolveSSHConnectionResponse
Contains SSH connection details:
- Path to the SSH configuration file
- Host identifier for the SSH connection

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- The `TunnelStatus` method uses server-side streaming to provide real-time updates on tunnel status
- Requests include workspace instance identifiers to target specific workspaces

## Dependencies
- Depends on the Supervisor API for tunnel visibility definitions
- Used by the local app client running on users' machines
- Integrated with SSH configuration management

## Usage Examples
- Local development tools use this API to establish port forwarding to workspace services
- IDE extensions use this API to enable SSH-based remote development
- CLI tools use this API to connect to workspace resources

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new tunneling and connection options without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Local App API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the local-app-api directory:
   ```bash
   cd components/local-app-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh` and defines some custom functions:

- `install_dependencies`: Installs required protoc plugins
- `local_go_protoc`: Generates Go code with specific include paths for third-party dependencies
- `update_license`: Updates license headers in generated files

The Local App API has a dependency on the Supervisor API for tunnel visibility definitions, which is included in the protoc generation process.

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Local App API. This typically involves:

1. For Go components:
   ```bash
   cd <component-directory>
   go build ./...
   ```

2. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Local App API is primarily used by the local-app component, which is a desktop application that runs on users' machines to facilitate communication with remote Gitpod workspaces.
