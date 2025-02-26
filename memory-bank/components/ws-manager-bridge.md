# Workspace Manager Bridge Component

## Overview

The Workspace Manager Bridge (ws-manager-bridge) is a critical component in the Gitpod architecture that acts as an intermediary between the workspace manager (ws-manager) and the rest of the Gitpod platform. It subscribes to workspace status updates from the workspace manager, processes these updates, and synchronizes the information with the database and other components of the system.

## Purpose

The primary purposes of the Workspace Manager Bridge component are:
- Subscribe to workspace status updates from workspace managers
- Process and transform workspace status information
- Update the database with current workspace instance states
- Trigger appropriate actions based on workspace lifecycle events
- Provide metrics and monitoring for workspace instances
- Manage workspace cluster information and available workspace classes
- Bridge the communication between workspace managers and other Gitpod components
- Handle prebuild status updates and synchronization
- Expose a gRPC service for cluster management

## Architecture

The Workspace Manager Bridge consists of several key components:

1. **Bridge Controller**: Manages the lifecycle of bridges to workspace clusters
2. **Workspace Manager Bridge**: Handles status updates from workspace managers
3. **Workspace Instance Controller**: Controls workspace instances based on their state
4. **Prebuild Updater**: Updates prebuild information based on workspace status
5. **Cluster Service Server**: Provides a gRPC service for cluster management
6. **Metrics**: Collects and exposes metrics about workspace instances

The component is designed to be resilient to failures, with mechanisms for reconnection, message queuing, and error handling.

## Key Files and Structure

- `src/main.ts`: Entry point for the application
- `src/bridge.ts`: Core implementation of the workspace manager bridge
- `src/bridge-controller.ts`: Controls bridges to workspace clusters
- `src/workspace-instance-controller.ts`: Controls workspace instances
- `src/prebuild-updater.ts`: Updates prebuild information
- `src/cluster-service-server.ts`: gRPC service for cluster management
- `src/wsman-subscriber.ts`: Subscribes to workspace manager events
- `src/metrics.ts`: Metrics collection and reporting
- `src/config.ts`: Configuration for the component
- `src/container-module.ts`: Dependency injection setup

## Workflow

The Workspace Manager Bridge follows this general workflow:

1. **Initialization**:
   - Connect to the database
   - Set up metrics and tracing
   - Start the bridge controller
   - Start the cluster service server
   - Start the workspace instance controller

2. **Status Update Handling**:
   - Subscribe to status updates from workspace managers
   - Queue updates by instance ID to ensure proper ordering
   - Process updates and update the database
   - Trigger appropriate actions based on workspace lifecycle events
   - Update prebuild information if necessary
   - Publish instance updates to Redis for other components

3. **Workspace Instance Control**:
   - Periodically check workspace instances
   - Enforce timeouts and other policies
   - Handle stopped workspaces

4. **Workspace Class Management**:
   - Periodically update workspace class information from clusters
   - Store updated information in the database

## Status Update Processing

The bridge processes workspace status updates from the workspace manager and maps them to the Gitpod data model:

1. **Phase Mapping**: Maps workspace phases (PENDING, CREATING, INITIALIZING, RUNNING, STOPPING, STOPPED) to the corresponding database representation
2. **Condition Mapping**: Maps workspace conditions (deployed, failed, timeout, etc.) to the database
3. **Port Mapping**: Maps exposed ports and their visibility/protocol
4. **Timestamp Recording**: Records important timestamps (started, deployed, stopped)
5. **Metrics Collection**: Collects metrics about workspace instances
6. **Lifecycle Handling**: Triggers appropriate actions based on lifecycle events

## Dependencies

### Internal Dependencies
- `@gitpod/gitpod-db`: Database access
- `@gitpod/gitpod-protocol`: Shared protocol definitions
- `@gitpod/ws-manager`: Workspace manager client
- `@gitpod/ws-manager-bridge-api`: Bridge API definitions
- `@gitpod/ws-daemon`: Workspace daemon client

### External Dependencies
- Express for metrics endpoint
- Prometheus client for metrics
- gRPC for communication with workspace managers
- Redis for publishing instance updates

## Integration Points

The Workspace Manager Bridge integrates with:
1. **Workspace Manager**: Subscribes to workspace status updates
2. **Database**: Updates workspace instance information
3. **Redis**: Publishes instance updates for other components
4. **Prometheus**: Exposes metrics
5. **Other Gitpod Components**: Provides workspace status information

## Configuration

The Workspace Manager Bridge is configured through environment variables:

- `CONTROLLER_INTERVAL_SECONDS`: Interval for controller operations
- `CONTROLLER_MAX_DISCONNECT_SECONDS`: Maximum time to wait for reconnection
- Various database and connection settings

## Metrics

The component exposes various metrics:

- Workspace instance status updates
- Workspace startup time
- First user activity
- Stale status updates
- Update processing time
- Error counts

## Common Usage Patterns

The Workspace Manager Bridge is typically used to:
1. Monitor workspace instance status
2. Update the database with current workspace states
3. Trigger actions based on workspace lifecycle events
4. Collect metrics about workspace instances
5. Manage workspace cluster information

## Related Components

- **Workspace Manager**: Manages workspace instances in Kubernetes
- **Workspace Daemon**: Manages workspace-level operations
- **Database**: Stores workspace instance information
- **Server**: Uses workspace instance information for API responses
- **Dashboard**: Displays workspace status to users
