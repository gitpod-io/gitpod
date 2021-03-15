---
url: /docs/self-hosted/latest/install/troubleshooting/
---

# Troubleshooting

This section should solve all errors that might come up during installation of Gitpod.


## 1. `ws-daemon` is stuck in `Init: 0/1`

`kubectl describe pod ws-daemon-...` gives:
`MountVolume.SetUp failed for volume "node-fs1" : hostPath type check failed: /run/containerd/io.containerd.runtime.v1.linux/k8s.io is not a directory`

### Solution
 1. `ssh` onto the node, `mount | grep rootfs` and find the directory where your containers are stored. Common paths are:
    - `/run/containerd/io.containerd.runtime.v1.linux/k8s.io`
    - `/run/containerd/io.containerd.runtime.v1.linux/moby`
    - `/run/containerd/io.containerd.runtime.v2.task/k8s.io`

 2. _Merge_ the following into your `values.custom.yaml`:
    ```
    components:
      wsDaemon:
        containerRuntime:
          nodeRoots:
          - <your path here>
    ```

 3. Do an `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.


## 2. `helm install` fails with: "minio access key is required, please add a value to your values.yaml"

Since `0.7.0` minio requires custom credentials to be configured.

### Solution
 1. Follow the [Upgrade Guide](../upgrade/).


## 3. After upgrade, the `minio` Pod is stuck in `ContainerCreating`

This is caused by a bug in the minio Helm chart which blocks itself on updates.

### Solution
 1. `kubectl scale deployments/minio --replicas=0`

 1. `kubectl scale deployments/minio --replicas=1`

 1. Wait until the pod comes up.