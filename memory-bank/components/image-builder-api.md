# Image Builder API

## Overview
The Image Builder API defines the gRPC interfaces for the Image Builder service, which is responsible for building Docker images for workspaces within the Gitpod platform. This API enables the dynamic creation, management, and monitoring of workspace image builds.

## Purpose
This API provides a standardized interface for:
- Resolving Docker image references to their digest form
- Building workspace Docker images based on configuration
- Streaming build logs during the image building process
- Managing and monitoring ongoing builds
- Creating and retrieving subassemblies from OCI images

## Architecture
The Image Builder API is implemented as a set of gRPC services defined in Protocol Buffer files. These definitions are used to generate client and server code in various languages (Go, TypeScript) for use by other components in the system.

## Key Services

### ImageBuilder
Provides methods for building and managing Docker images:

- `ResolveBaseImage`: Returns the "digest" form of a Docker image tag, making it absolute
- `ResolveWorkspaceImage`: Returns information about a build configuration without actually building
- `Build`: Initiates the build of a Docker image using a build configuration
- `Logs`: Streams the build output of an ongoing Docker build
- `ListBuilds`: Returns a list of currently running builds

### SubassemblyService
Provides methods for managing subassemblies (pre-built components that can be used in workspace images):

- `CreateSubassembly`: Creates a subassembly from an OCI image
- `GetSubassembly`: Returns the status and URL for a subassembly

## Key Data Structures

### BuildSource
Defines the source for a build, which can be either:
- A reference to an existing image
- A Dockerfile with associated context and initialization

### BuildRegistryAuth
Defines authentication settings for accessing Docker registries during the build process.

### BuildStatus
Enum representing the status of a build:
- `unknown`: Status is not known
- `running`: Build is currently in progress
- `done_success`: Build completed successfully
- `done_failure`: Build failed

### BuildInfo
Contains detailed information about a build:
- Reference to the built image
- Base image reference
- Build status
- Start time
- Build ID
- Log information

### SubassemblyStatus
Contains information about a subassembly:
- Phase (creating, available, unavailable)
- Message describing the state
- Digest of the subassembly file
- URL for downloading the subassembly
- Manifest describing requirements

## Communication Patterns
- The API uses gRPC for efficient, typed communication between services
- The `Build` and `Logs` methods use server-side streaming to provide real-time updates
- Authentication information is passed in request messages
- Subassembly operations are designed for asynchronous processing

## Dependencies
- Depends on the Content Service API for workspace initialization
- Used by workspace manager to build workspace images
- Integrated with container registries for image storage and retrieval

## Usage Examples
- Workspace creation process uses this API to build custom workspace images
- Prebuild processes use this API to prepare images ahead of time
- Monitoring systems use this API to track build status and logs

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new build options and features without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Image Builder API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the image-builder-api directory:
   ```bash
   cd components/image-builder-api
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
After regenerating the code, you may need to rebuild components that depend on the Image Builder API. This typically involves:

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
