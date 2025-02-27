# IDE Service API

## Overview
The IDE Service API defines the gRPC interfaces for the IDE Service, which is responsible for managing IDE configurations and resolving workspace IDE requirements within the Gitpod platform. This API enables the dynamic configuration of IDEs based on user preferences and workspace requirements.

## Purpose
This API provides a standardized interface for:
- Retrieving user-specific IDE configurations
- Resolving workspace IDE requirements based on multiple factors
- Determining the appropriate IDE images and configurations for workspaces
- Managing environment variables and settings for IDE instances

## Architecture
The IDE Service API is implemented as a gRPC service defined in Protocol Buffer files. These definitions are used to generate client and server code in various languages (Go, TypeScript, Java) for use by other components in the system.

## Key Services

### IDEService
Provides methods for IDE configuration and workspace resolution:

- `GetConfig`: Retrieves IDE configuration for a specific user
- `ResolveWorkspaceConfig`: Resolves the IDE configuration for a workspace based on various inputs

## Key Data Structures

### User
Represents a user in the system:
- User ID
- Optional email

### WorkspaceType
Enum defining the type of workspace:
- `REGULAR`: Standard development workspace
- `PREBUILD`: Prebuild workspace for faster startup

### EnvironmentVariable
Represents an environment variable as a key-value pair:
- Name
- Value

### ResolveWorkspaceConfigResponse
Contains the resolved configuration for a workspace:
- Environment variables
- Supervisor image
- Web image
- IDE image layers
- Referer IDE (for controlling default IDE configuration)
- Tasks configuration
- IDE settings

## Communication Patterns
- The API uses gRPC for efficient, typed communication between services
- Methods are marked as idempotent where appropriate
- Configuration is returned as structured data for easy consumption by clients

## Dependencies
- Used by workspace manager to configure IDE environments
- Used by supervisor to set up the IDE within a workspace
- Depends on user preferences and workspace configuration

## Usage Examples
- Workspace creation process uses this API to determine the appropriate IDE configuration
- User preference changes trigger updates to IDE configurations
- Prebuild processes use this API to ensure consistent IDE setup

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new configuration options without breaking existing clients.

## Configuration Resolution Process
The workspace configuration resolution process considers multiple factors:
1. Workspace type (regular or prebuild)
2. Context information about the workspace
3. User's IDE settings
4. Workspace-specific configuration
5. User information

The resolution process produces a complete configuration including:
- Environment variables for the IDE
- Container images to use
- IDE-specific settings
- Task configurations

This allows for a highly customizable yet consistent IDE experience across different workspaces and users.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The IDE Service API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the ide-service-api directory:
   ```bash
   cd components/ide-service-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Generates TypeScript code using `ts_proto`
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`:

- `install_dependencies`: Installs required protoc plugins
- `go_protoc`: Generates Go code
- `typescript_ts_protoc`: Generates TypeScript code using ts_proto
- `update_license`: Updates license headers in generated files

The IDE Service API generates TypeScript code using the ts_proto plugin, which creates more modern TypeScript interfaces compared to the standard protoc TypeScript generator.

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the IDE Service API. This typically involves:

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
