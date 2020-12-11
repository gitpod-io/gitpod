---
url: /docs/self-hosted/latest/install/nodes/
---
#####TODO Move to repo as part of reference?
# Kubernetes Nodes

Configure the nodes (computers or virtual machines) that Kuberntes runs Gitpod's workspace pods on.

## Assign workload to Nodes
Gitpod schedules two kinds of workloads: the Gitpod installation itself (which we refer to as _meta_) and the workspaces. Ideally both types of workloads run on seperate nodes to make makes scaling easier.
Depending on your cluster size that may not be feasible though. Either way, you need two node labels in your cluster:
- `gitpod.io/workload_meta=true` which marks the "meta" nodes and
- `gitpod.io/workload_workspace=true ` which marks the workspace nodes.

If you want to "mix 'n match", i.e., don't separate the nodes, you can simply run:
```
kubectl label node --all gitpod.io/workload_meta=true gitpod.io/workload_workspace=true
```


## Node Filesystem Layout
Gitpod relies on the node's filesystem for making workspace content available, as well as for storing Theia. By default workspace data is placed in `/data` and Theia is copied to `/theia`. Depending on your node setup the root filesystem maybe **read-only** or **slow**.
We recommend you change those two paths so that they're located on an SSD or some other form of fast local storage.

To do this:
   - `echo values/node-layout.yaml >> configuration.txt`
   - in `values/node-layout.yaml` change the values to match your installation
