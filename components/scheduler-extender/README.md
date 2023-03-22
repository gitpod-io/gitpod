Custom scheduler extender
----

Gitpod uses dedicated autoscaling groups where the workspaces pods run.

Nodes in the ASG run two daemonsets: `ws-daemon` and `registry-facade`.

Due to the async nature of Kubernetes, under some circumstances, the default scheduler could assign a node where any of the components is passing the Readiness probes but still not ready to serve requests.

To avoid this issue, the scheduler extender filter pods and nodes were:

- The pod is a workspace (labels `component=workspace`)
- It is a node for workspaces (labels `gitpod.io/workload_workspace_regular=true` or `gitpod.io/workload_workspace_headless=true`)
- The node contains the `ws-daemon` and `registry-facade` readiness labels, and the value is `true`

### Installation

The scheduler is installed as a secondary scheduler using the name `gitpod-scheduler`.

### How can we use it?

Unless a pod configures a particular scheduler, it will use the default one called `default-scheduler`.
We can see the scheduler used for a running pod executing `kubectl describe pods`.

To indicate the use of the custom scheduler, the pod needs to contain the field `schedulerName: gitpod-scheduler` (the installer provides a field to set such value)

The repository provides two simple yaml files that show how to use the custom scheduler and what happens when the field is configured, but the conditions are not met (the pod will stay in a pending state).


**References:**
- https://kubernetes.io/docs/concepts/extend-kubernetes/#scheduling-extensions
- https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/
- https://github.com/kubernetes-sigs/scheduler-plugins
