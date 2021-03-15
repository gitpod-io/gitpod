---
url: /docs/self-hosted/latest/install/workspaces/
---

# Workspaces

## Sizing

Gitpod schedules workspaces as Kubernetes pods. Each workspace pod requests a certain amount of memory which directly affects how many workspaces are scheduled on a single node.
If you want to change the default sizing (~ 8GiB per workspace) you should
 1. Merge the following into your `values.custom.yaml`:
    ```yaml
    # workspaceSizing configures the resources available to each workspace. These settings directly impact how
    # desenly we pack workspaces on nodes where workspacesPerNode = memoryAvailable(node) / memoryRequest.
    #
    # Beware: if a workspace exceeds its memoryLimit, some of its processes may be terminated (OOM-kill) which
    # results in a broken user experience.
    workspaceSizing:
      requests:
        cpu: "1m"
        memory: "2.25Gi"
        storage: "5Gi"
      limits:
        cpu: "5"
        memory: "12Gi"
      dynamic:
        # Gitpod supports dynamic CPU limiting. We express those limits in "buckets of CPU time" (jiffies where 1 jiffie is 1% of a vCPU).
        # Each bucket has a limit (i.e. max CPU rate in jiffies/sec, 100 jiffies/sec = 1 vCPU).
        #
        # For example:
        #   # three minutes of 5 CPUs: 5 [numCPU] * 100 [jiffies/sec] * (3 * 60) [seconds] = 90000
        #   - budget: 90000
        #     limit: 500
        #   # five minutes  of 4 CPUs: 4 [numCPU] * 100 [jiffies/sec] * (5 * 60) [seconds] = 120000
        #   - budget: 120000
        #     limit: 400
        #   # remainder of 2 CPUs where a user has to stay below sustained use of 1.8 CPUs for 5 minutes:
        #   #                       1.8 [numCPU] * 100 [jiffies/sec] * (5 * 60) [seconds] = 54000
        #   - budget: 54000
        #     limit: 200
        #
        # if there are no buckets configured, the dynamic CPU limiting is disabled.
        cpu:
          buckets: []
          samplingPeriod: "10s"
          controlPeriod: "15m"
    ```

 2. Do a `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.
