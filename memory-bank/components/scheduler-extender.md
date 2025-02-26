# Scheduler-Extender Component

## Overview

The Scheduler-Extender component in Gitpod appears to be a Kubernetes scheduler extender that enhances the default Kubernetes scheduling capabilities. It is implemented as a wrapper around an external image hosted on AWS ECR. Kubernetes scheduler extenders allow for custom scheduling decisions beyond what the default scheduler provides, enabling more sophisticated workload placement based on custom criteria.

## Purpose

While specific implementation details are limited in the codebase, based on the component's name and general knowledge of Kubernetes scheduler extenders, the primary purposes of the Scheduler-Extender component likely include:

- Extend Kubernetes scheduling decisions for Gitpod workspaces
- Implement custom scheduling logic specific to Gitpod's requirements
- Optimize workspace placement across cluster nodes
- Consider specialized resource requirements for workspaces
- Support advanced scheduling features not available in the default Kubernetes scheduler
- Enable workload-specific placement policies
- Integrate with Gitpod's workspace management system
- Improve resource utilization across the cluster
- Support specialized node selection criteria

## Architecture

Based on the available information, the Scheduler-Extender component:

1. **External Image**: Uses an image from AWS ECR (`public.ecr.aws/b4b1c2l9/application/k5t9d3j5/application/scheduler-extender`)
2. **Kubernetes Integration**: Likely integrates with the Kubernetes API server as a scheduler extender
3. **HTTP API**: Probably exposes an HTTP API that the Kubernetes scheduler calls during scheduling decisions

As a Kubernetes scheduler extender, it would typically:
1. Register with the Kubernetes scheduler through configuration
2. Receive filter and prioritize requests from the Kubernetes scheduler
3. Apply custom logic to determine suitable nodes for workspaces
4. Return results to the Kubernetes scheduler for final placement decisions

## Key Features

Based on general knowledge of Kubernetes scheduler extenders, the component likely provides:

### Custom Scheduling Logic

- **Workspace-Specific Criteria**: Custom criteria for workspace scheduling
- **Resource Optimization**: Advanced resource allocation strategies
- **Node Filtering**: Custom filtering of nodes based on Gitpod-specific requirements
- **Node Prioritization**: Custom scoring of nodes to optimize workspace placement
- **Affinity Rules**: Implementation of specialized affinity/anti-affinity rules

### Integration Capabilities

- **Kubernetes API Integration**: Integration with the Kubernetes scheduler
- **Gitpod Component Awareness**: Awareness of other Gitpod components' requirements
- **Node Labeling**: Potential integration with node labels for scheduling decisions
- **Resource Management**: Custom resource tracking and allocation

## Configuration

The component is likely configured through:

1. **Kubernetes Scheduler Configuration**: Registration as an extender in the kube-scheduler configuration
2. **Custom Configuration**: Specific configuration for Gitpod's scheduling requirements
3. **Version Management**: Versioned through the `schedulerExtenderVersion` variable

## Integration Points

The Scheduler-Extender component likely integrates with:

1. **Kubernetes Scheduler**: For extending scheduling decisions
2. **Kubernetes API Server**: For accessing cluster state information
3. **Workspace Manager**: For understanding workspace requirements
4. **Node Labeler**: For using node labels in scheduling decisions
5. **Cluster Autoscaler**: For coordinating with cluster scaling activities

## Usage Patterns

### Scheduling Flow

1. Kubernetes scheduler receives a pod creation request for a workspace
2. Scheduler performs its default filtering and prioritization
3. Scheduler calls the scheduler-extender for custom filtering
4. Scheduler-extender applies Gitpod-specific logic to filter nodes
5. Scheduler calls the scheduler-extender for custom prioritization
6. Scheduler-extender scores nodes based on Gitpod-specific criteria
7. Kubernetes scheduler combines all scores and selects the best node
8. Workspace pod is scheduled on the selected node

## Dependencies

### Internal Dependencies
None explicitly specified in the available code.

### External Dependencies
- AWS ECR hosted image: `public.ecr.aws/b4b1c2l9/application/k5t9d3j5/application/scheduler-extender`

## Security Considerations

As a scheduler extender, the component would need to consider:

1. **API Security**: Secure communication with the Kubernetes API
2. **Authentication**: Proper authentication for API access
3. **Authorization**: Appropriate RBAC permissions for scheduling decisions
4. **Resource Isolation**: Ensuring proper isolation between workspaces
5. **Denial of Service Prevention**: Preventing scheduling decisions that could lead to resource exhaustion

## Implementation Details

The component appears to be implemented as a wrapper around an external image, suggesting that:

1. The core scheduling logic is maintained separately
2. The component may be part of Gitpod's enterprise offering
3. The implementation details are not fully open-sourced

Based on the CODEOWNERS file, the component is maintained by the Gitpod Engine team and Enterprise team.

## Related Components

- **WS-Manager-MK2**: Likely interacts with the scheduler-extender for workspace scheduling
- **Node-Labeler**: Provides node labels that may be used in scheduling decisions
- **Cluster-Autoscaler**: May coordinate with the scheduler-extender for scaling decisions
- **Registry-Facade**: Listed as a dependency in the build configuration

## Notes

This documentation is based on limited information available in the codebase. The scheduler-extender component appears to be a wrapper around an external image, with minimal code present in the open-source repository. For more detailed information, internal Gitpod documentation or the team responsible for the component (Engine and Enterprise teams) should be consulted.
