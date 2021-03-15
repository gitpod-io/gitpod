---
url: /docs/self-hosted/latest/install/nodes/
---

# Kubernetes Nodes

Configure the nodes (computers or virtual machines) that Kubernetes runs Gitpod's workspace pods on.

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
 1. Merge the following into your `values.custom.yaml`:
    ```yaml
    components:
      imageBuilder:
        # The image builder deploys a Docker-in-Docker-daemon. By default that Docker daemon works in an empty-dir on the node.
        # Depending on the types of node you operate that may cause image builds to fail or not perform well. We recommend you give the Docker daemon
        # fast storage on the node, e.g. an SSD.
        hostDindData: /mnt/disks/ssd0/docker
      wsDaemon:
        # Workspace data is stored on the nodes. This setting configures where on the ndoe the workspace data lives.
        # The faster this location is (in terms of IO) the faster workspaces will initialize.
        hostWorkspaceArea: /mnt/disks/ssd0/workspaces
    ```
 2. Do a `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.

    > Note that Helm does _not_ merge hierarchies in a single file. Please make sure there is only ever _one_ `components` hierarchy or the last one overwrites all previous values.
