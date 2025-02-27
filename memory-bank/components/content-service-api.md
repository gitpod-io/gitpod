# Content Service API

## Overview
The Content Service API defines the gRPC interfaces for the Content Service, which is responsible for managing various types of content within the Gitpod platform, including workspace files, blobs, logs, and IDE plugins.

## Purpose
This API provides a standardized interface for other components to interact with the Content Service, enabling operations such as:
- Managing workspace content (downloading, deleting, checking snapshots)
- Handling blob storage (uploading, downloading, deleting)
- Accessing headless logs
- Managing IDE plugins
- Defining workspace initialization methods

## Architecture
The Content Service API is implemented as a set of gRPC services defined in Protocol Buffer files. These definitions are used to generate client and server code in various languages (Go, TypeScript) for use by other components in the system.

## Key Services

### ContentService
Provides core content management functionality:
- `DeleteUserContent`: Deletes all content associated with a user

### WorkspaceService
Manages workspace content:
- `WorkspaceDownloadURL`: Provides a URL from which workspace content can be downloaded
- `DeleteWorkspace`: Deletes the content of a single workspace
- `WorkspaceSnapshotExists`: Checks whether a workspace snapshot exists

### BlobService
Handles blob storage operations:
- `UploadUrl`: Provides a URL to which clients can upload content via HTTP PUT
- `DownloadUrl`: Provides a URL from which clients can download content via HTTP GET
- `Delete`: Deletes uploaded content

### HeadlessLogService
Manages access to headless logs:
- `LogDownloadURL`: Provides a URL from which logs can be downloaded
- `ListLogs`: Returns a list of task IDs for a specified workspace instance

### IDEPluginService
Manages IDE plugins:
- `UploadURL`: Provides a URL for uploading plugin content
- `DownloadURL`: Provides a URL for downloading plugin content
- `PluginHash`: Provides a hash of a plugin

## Key Data Structures

### WorkspaceInitializer
Defines how a workspace is initialized, with several initialization methods:
- `EmptyInitializer`: Creates an empty workspace
- `GitInitializer`: Initializes from a Git repository
- `SnapshotInitializer`: Initializes from a snapshot
- `PrebuildInitializer`: Combines snapshots with Git
- `CompositeInitializer`: Uses multiple initializers in sequence
- `FileDownloadInitializer`: Downloads files for workspace content
- `FromBackupInitializer`: Initializes from a backup

### GitStatus
Describes the current Git working copy status, similar to a combination of "git status" and "git branch".

## Communication Patterns
- The API uses gRPC for efficient, typed communication between services
- Many operations return URLs rather than content directly, allowing for efficient transfer of large files
- Authentication information is passed in request messages

## Dependencies
- Used by various components that need to interact with workspace content
- Depends on underlying storage systems (not specified in the API)

## Usage Examples
- Workspace Manager uses this API to initialize workspaces
- Dashboard uses this API to provide download links for workspace content
- IDE components use this API to access plugins

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Content Service API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the content-service-api directory:
   ```bash
   cd components/content-service-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Generates TypeScript code
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`, which provides common functionality for all API components:

- `install_dependencies`: Installs required protoc plugins
- `protoc_buf_generate`: Uses the `buf` tool to generate code based on the configuration in `buf.gen.yaml`
- `update_license`: Updates license headers in generated files

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Content Service API. This typically involves:

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
