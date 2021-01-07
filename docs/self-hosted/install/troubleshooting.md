---
url: /docs/self-hosted/latest/install/troubleshooting/
---

# Troubleshooting

This section should solve all errors that might come up during installation of Gitpod.

 - `ws-daemon` is stuck in `Init: 0/1`,
   
   `kubectl describe pod ws-daemon-...` gives:
   `MountVolume.SetUp failed for volume "node-fs1" : hostPath type check failed: /run/containerd/io.containerd.runtime.v1.linux/k8s.io is not a directory`

   `ssh` onto the node, `mount | grep rootfs` and find the directory where your containers are stored. Examples:
     - `/run/containerd/io.containerd.runtime.v1.linux/k8s.io`
     - `/run/containerd/io.containerd.runtime.v1.linux/moby`
     - `/run/containerd/io.containerd.runtime.v2.task/k8s.io`

   Then adjust `components.wsDaemon.containerRuntime.nodeRoots` accordingly.