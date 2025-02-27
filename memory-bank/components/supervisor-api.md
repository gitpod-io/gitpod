# Supervisor API

## Overview
The Supervisor API defines the gRPC interfaces for the Supervisor service, which runs inside each workspace container and provides core functionality for workspace management, terminal handling, port forwarding, and other essential workspace operations. This API enables communication between various components and the supervisor process.

## Purpose
This API provides a standardized interface for:
- Managing terminal sessions within workspaces
- Controlling port exposure and tunneling
- Retrieving workspace information
- Managing workspace tasks
- Handling notifications and status updates
- Managing SSH access to workspaces
- Controlling workspace lifecycle

## Architecture
The Supervisor API is implemented as a set of gRPC services defined in multiple Protocol Buffer files. These definitions are used to generate client and server code in various languages (Go, TypeScript, Java) for use by the supervisor and other components in the system.

## Key Services

### ControlService
Provides methods for workspace control operations:
- `ExposePort`: Exposes a port from the workspace
- `CreateSSHKeyPair`: Creates SSH keys for accessing the workspace
- `CreateDebugEnv`: Creates a debug workspace environment
- `SendHeartBeat`: Sends heartbeats to keep the workspace alive

### InfoService
Provides methods for retrieving workspace information:
- `WorkspaceInfo`: Returns detailed information about the workspace

### PortService
Manages port forwarding and tunneling:
- `Tunnel`: Notifies clients to install listeners on remote machines
- `CloseTunnel`: Notifies clients to remove listeners on remote machines
- `EstablishTunnel`: Establishes a tunnel for an incoming connection
- `AutoTunnel`: Controls enablement of auto tunneling
- `RetryAutoExpose`: Retries auto-exposing a port

### TerminalService
Manages terminal sessions within the workspace:
- `Open`: Opens a new terminal running the login shell
- `Shutdown`: Closes a terminal, killing all child processes
- `Get`: Returns information about an opened terminal
- `List`: Lists all open terminals
- `Listen`: Streams terminal output
- `Write`: Writes input to a terminal
- `SetSize`: Sets the terminal's size
- `SetTitle`: Sets the terminal's title
- `UpdateAnnotations`: Updates the terminal's annotations

### TaskService
Manages workspace tasks:
- `ListenToOutput`: Streams the output of a given task

### StatusService (inferred from status.proto)
Provides status information about the workspace:
- Status updates for workspace components
- Health checks

### NotificationService (inferred from notification.proto)
Handles notifications within the workspace:
- Sending notifications to users
- Managing notification state

### TokenService (inferred from token.proto)
Manages authentication tokens:
- Token generation and validation
- Token-based access control

## Key Data Structures

### Terminal
Represents a terminal session:
- Alias (identifier)
- Command being executed
- Title
- Process ID
- Working directory
- Annotations
- Title source

### TunnelVisiblity
Enum defining the visibility of a port tunnel:
- `none`: Not visible
- `host`: Visible to the host
- `network`: Visible to the network

### WorkspaceInfoResponse
Contains detailed information about a workspace:
- Workspace ID and instance ID
- Checkout and workspace locations
- User home directory
- Gitpod API information
- Repository information
- IDE configuration
- Workspace class information

### DebugWorkspaceType
Enum defining the type of debug workspace:
- `noDebug`: Not a debug workspace
- `regular`: Regular debug workspace
- `prebuild`: Prebuild debug workspace

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Many services provide REST endpoints via gRPC Gateway annotations
- Several services use server-side streaming for real-time updates
- Terminal and task services stream output data
- Port tunneling uses bidirectional streaming

## Dependencies
- Used by IDE components to interact with the workspace
- Used by the workspace manager to control workspace lifecycle
- Used by the local app for port forwarding and SSH access
- Integrated with the content service for workspace content management

## Usage Examples
- IDE extensions use the terminal service to create and manage terminal sessions
- Port forwarding tools use the port service to expose workspace ports
- Workspace manager uses the control service to manage workspace lifecycle
- Task runners use the task service to execute and monitor workspace tasks

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new methods and message fields without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Supervisor API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the supervisor-api directory:
   ```bash
   cd components/supervisor-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Generates gRPC Gateway code for REST endpoints
- Generates Java code using `generate-java.sh`
- Updates license headers
- Removes trailing whitespace from Java files

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh` and defines some custom functions:

- `install_dependencies`: Installs required protoc plugins
- `local_go_protoc`: Generates Go code with specific include paths for third-party dependencies
- `go_protoc_gateway`: Generates gRPC Gateway code for REST endpoints
- `update_license`: Updates license headers in generated files

The `generate-java.sh` script:
- Temporarily modifies proto files to handle Java reserved keywords
- Downloads the gRPC Java plugin if needed
- Generates Java code
- Reverts the temporary modifications to proto files

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Supervisor API. This typically involves:

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

3. For Java components:
   ```bash
   cd <component-directory>/java
   ./gradlew build
   ```

4. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Supervisor API is a critical component of the Gitpod platform, as it provides the interface through which various components interact with the workspace environment.
