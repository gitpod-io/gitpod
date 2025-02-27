# Workspace Manager Bridge API

## Overview
The Workspace Manager Bridge API defines the gRPC interfaces for the Workspace Manager Bridge service, which enables dynamic management of workspace clusters within the Gitpod platform. This API allows for the registration, updating, and deregistration of workspace clusters, facilitating multi-cluster deployments and cluster lifecycle management.

## Purpose
This API provides a standardized interface for:
- Registering new workspace clusters
- Updating properties of existing workspace clusters
- Deregistering workspace clusters
- Listing currently registered workspace clusters
- Managing admission constraints for workspace clusters
- Controlling cluster state (available, cordoned, draining)

## Architecture
The Workspace Manager Bridge API is implemented as a gRPC service defined in Protocol Buffer files. These definitions are used to generate client and server code in Go and TypeScript for use by the workspace manager bridge and other components in the system.

## Key Services

### ClusterService
Provides methods for managing workspace clusters:

- `Register`: Registers a new workspace cluster
- `Update`: Modifies properties of an already registered workspace cluster
- `Deregister`: Removes a workspace cluster from available clusters
- `List`: Returns the currently registered workspace clusters

## Key Data Structures

### ClusterStatus
Represents the current status of a workspace cluster:
- Name and URL
- State (UNKNOWN, AVAILABLE, CORDONED, DRAINING)
- Score and maximum score
- Admission constraints
- Region information
- Whether the cluster is static or governed

### TlsConfig
Contains TLS configuration for secure communication with a cluster:
- CA certificate
- Client certificate
- Client key

### RegistrationHints
Provides hints for cluster registration:
- Preferability (None, Prefer, DontSchedule)
- Cordoned status

### AdmissionConstraint
Defines constraints for workspace admission to a cluster:
- Feature preview constraints
- Permission-based constraints

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Requests include cluster names to identify the relevant cluster
- Updates can be applied to specific properties of a cluster
- Deregistration can be forced even if instances are still running

## Dependencies
- Used by the server component for cluster management
- Used by the ws-manager-bridge to communicate with workspace managers
- Integrated with Kubernetes for cluster management

## Usage Examples
- Cluster management systems use this API to register new workspace clusters
- Load balancing systems use this API to update cluster scores
- Administrative tools use this API to cordon or drain clusters
- Monitoring systems use this API to list available clusters

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new cluster management features without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Workspace Manager Bridge API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go and TypeScript needs to be regenerated.

To regenerate the code:

1. Navigate to the ws-manager-bridge-api directory:
   ```bash
   cd components/ws-manager-bridge-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates code using buf based on the configuration in `buf.gen.yaml`
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`:

- `install_dependencies`: Installs required protoc plugins
- `protoc_buf_generate`: Generates code using buf based on the configuration in `buf.gen.yaml`
- `update_license`: Updates license headers in generated files

The `buf.gen.yaml` file configures the code generation:
- Generates Go code with appropriate module paths
- Generates JavaScript and TypeScript code with gRPC support

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Workspace Manager Bridge API. This typically involves:

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

The Workspace Manager Bridge API is primarily used by the ws-manager-bridge component, which bridges between workspace managers and the rest of the platform. It plays a critical role in multi-cluster deployments by enabling dynamic management of workspace clusters, facilitating load balancing, and providing a unified interface for cluster operations.
