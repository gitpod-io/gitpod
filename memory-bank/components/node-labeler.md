# Node-Labeler Component

## Overview

The Node-Labeler component in Gitpod is a Kubernetes controller responsible for managing node labels and annotations that are required for workspaces to run properly. It monitors the status of critical services like registry-facade and ws-daemon on each node, and adds or removes labels accordingly. Additionally, it manages cluster-autoscaler annotations to prevent nodes with active workspaces from being scaled down.

## Purpose

The primary purposes of the Node-Labeler component are:
- Ensure workspaces are scheduled only on nodes with required services
- Add and remove node labels based on service availability
- Prevent cluster-autoscaler from removing nodes with active workspaces
- Enable efficient node utilization in Kubernetes clusters
- Facilitate proper workspace scheduling
- Monitor the health of critical workspace services
- Support the Gitpod workspace infrastructure
- Optimize cluster resource usage
- Provide metrics for service readiness

## Architecture

The Node-Labeler component consists of several key parts:

1. **Pod Reconciler**: Watches pods of critical services and updates node labels
2. **Node Scaledown Annotation Controller**: Manages cluster-autoscaler annotations based on workspace presence
3. **Health Checks**: Verifies service availability before adding labels
4. **Metrics Collection**: Tracks service readiness times and counts

The component operates as a Kubernetes controller with leader election, ensuring only one instance is active at a time. It uses the controller-runtime library to watch for changes to pods and workspaces, and reconciles the state of node labels and annotations accordingly.

## Key Features

### Node Labeling

- **Service Readiness Labels**: Adds labels to nodes when critical services are ready
- **Label Removal**: Removes labels when services are no longer available
- **Health Verification**: Checks TCP connectivity and service health before adding labels
- **Registry-Facade Verification**: Performs specific checks for registry-facade readiness
- **Automatic Reconciliation**: Periodically reconciles node labels to ensure correctness

### Cluster-Autoscaler Integration

- **Scale-down Prevention**: Adds annotations to prevent cluster-autoscaler from removing nodes with active workspaces
- **Workspace Tracking**: Monitors workspace presence on nodes
- **Annotation Management**: Adds or removes `cluster-autoscaler.kubernetes.io/scale-down-disabled` annotation
- **Periodic Reconciliation**: Regularly checks all nodes to ensure annotations are correct
- **Event-based Updates**: Responds to workspace creation, deletion, and node changes

### Monitoring and Metrics

- **Service Readiness Metrics**: Tracks how long it takes for services to become ready
- **Service Count Metrics**: Counts the number of service instances
- **Health Endpoints**: Provides health and readiness endpoints
- **Logging**: Detailed logging of label and annotation changes

## Configuration

The Node-Labeler component can be configured through command-line flags:

### General Configuration
- `--json-log`, `-j`: Produce JSON log output (default: true)
- `--verbose`, `-v`: Enable verbose logging
- `--namespace`: Namespace where Gitpod components are running (default: default)

### Service Configuration
- `--registry-facade-port`: Port for registry-facade node port (default: 31750)
- `--ws-daemon-port`: Port for ws-daemon service (default: 8080)

## Integration Points

The Node-Labeler component integrates with:
1. **Kubernetes API**: For managing node labels and annotations
2. **Registry-Facade**: Checks readiness of registry-facade service
3. **WS-Daemon**: Checks readiness of ws-daemon service
4. **Cluster-Autoscaler**: Prevents scale-down of nodes with active workspaces
5. **Workspace Controller**: Monitors workspace placement on nodes

## Usage Patterns

### Node Label Management
The component adds the following labels to nodes:
- `gitpod.io/registry-facade_ready_ns_<namespace>`: Indicates registry-facade is ready
- `gitpod.io/ws-daemon_ready_ns_<namespace>`: Indicates ws-daemon is ready

These labels are used by the workspace scheduler to ensure workspaces are only scheduled on nodes with the required services.

### Cluster-Autoscaler Annotation Management
The component adds or removes the following annotation:
- `cluster-autoscaler.kubernetes.io/scale-down-disabled`: Prevents cluster-autoscaler from removing nodes with active workspaces

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/ws-manager-api/go`: Workspace manager API
- `components/ws-manager-mk2`: Workspace manager CRDs

### External Dependencies
- Kubernetes controller-runtime: For building Kubernetes controllers
- Kubernetes client-go: For interacting with the Kubernetes API
- Prometheus metrics: For exposing metrics

## Security Considerations

The component implements several security measures:

1. **Least Privilege**: Requires only the necessary permissions to manage node labels and annotations
2. **Leader Election**: Ensures only one instance is active at a time
3. **Namespace Isolation**: Can be configured to watch only specific namespaces
4. **TLS Verification**: Supports TLS for secure communication with services
5. **Error Handling**: Proper handling of errors to prevent security issues

## Implementation Details

### Pod Reconciler

The Pod Reconciler watches for changes to pods with the component label matching "ws-daemon" or "registry-facade". When a pod becomes ready, it:
1. Checks if the pod is running on a node
2. Verifies TCP connectivity to the service
3. For registry-facade, performs additional HTTP health checks
4. Adds the appropriate label to the node if all checks pass
5. Removes the label when the pod is deleted or becomes not ready

### Node Scaledown Annotation Controller

The Node Scaledown Annotation Controller watches for changes to workspaces. When a workspace is created, deleted, or moved to a different node, it:
1. Counts the number of workspaces on the affected node
2. Adds the `cluster-autoscaler.kubernetes.io/scale-down-disabled` annotation if there are workspaces on the node
3. Removes the annotation if there are no workspaces on the node
4. Periodically reconciles all nodes to ensure annotations are correct

## Related Components

- **WS-Manager-MK2**: Uses the node labels for workspace scheduling
- **Registry-Facade**: Provides container images for workspaces
- **WS-Daemon**: Provides workspace services on nodes
- **Cluster-Autoscaler**: Uses annotations to determine which nodes can be scaled down
