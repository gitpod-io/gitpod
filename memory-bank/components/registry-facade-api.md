# Registry Facade API

## Overview
The Registry Facade API defines the gRPC interfaces and data structures for the Registry Facade service, which provides a container registry interface that dynamically assembles workspace images on-demand. This API enables the specification and retrieval of composite container images that combine base images, IDE layers, and workspace content.

## Purpose
This API provides a standardized interface for:
- Defining composite container images with multiple sources
- Specifying workspace content layers that can be added to images
- Retrieving image specifications for specific workspace instances
- Supporting dynamic image assembly in the container registry facade

## Architecture
The Registry Facade API is implemented as a set of gRPC services and message definitions in Protocol Buffer files. These definitions are used to generate client and server code in Go for use by the registry facade and other components in the system.

## Key Services

### SpecProvider
Provides methods for retrieving image specifications:

- `GetImageSpec`: Retrieves the image specification for a particular ID (typically a workspace instance ID)

## Key Data Structures

### ImageSpec
Defines the composition of a workspace image:
- `base_ref`: Reference to the base image in another registry
- `ide_ref`: Reference to the IDE image to use
- `content_layer`: Layers that provide the workspace's content
- `supervisor_ref`: Reference to the supervisor image to use
- `ide_layer_ref`: Layers needed by the IDE

### ContentLayer
Represents a layer that provides workspace content, which can be one of:
- `RemoteContentLayer`: Content that can be downloaded from a remote URL
- `DirectContentLayer`: Content provided directly as bytes

### RemoteContentLayer
Defines a layer that can be downloaded from a remote URL:
- URL pointing to the content location
- Digest (content hash) of the file
- Diff ID for uncompressed content
- Media type of the layer
- Size of the layer in bytes

### DirectContentLayer
Contains the bytes of an uncompressed tar file that is served directly as a layer.

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Image specifications are retrieved by ID, typically a workspace instance ID
- Content layers can be specified either by reference (URL) or directly (bytes)

## Dependencies
- Used by workspace manager to specify workspace images
- Used by registry facade to dynamically assemble images
- Integrated with container registry protocols

## Usage Examples
- Workspace manager uses this API to specify the composition of workspace images
- Registry facade uses this API to retrieve image specifications when serving container images
- Content service uses this API to provide workspace content layers

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new image specification options without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Registry Facade API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go needs to be regenerated.

To regenerate the code:

1. Navigate to the registry-facade-api directory:
   ```bash
   cd components/registry-facade-api
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
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`:

- `install_dependencies`: Installs required protoc plugins
- `go_protoc`: Generates Go code
- `update_license`: Updates license headers in generated files

The Registry Facade API is relatively simple compared to other APIs, focusing primarily on defining the structure of image specifications rather than complex service interactions.

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Registry Facade API. This typically involves:

1. For Go components:
   ```bash
   cd <component-directory>
   go build ./...
   ```

2. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Registry Facade API is primarily used by the registry-facade component, which provides a container registry interface that dynamically assembles workspace images on-demand.
