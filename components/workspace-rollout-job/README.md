# workspace-rollout-job

`workspace-rollout-job` performs a rollout from one workspace cluster to another while monitoring
metrics.

## Running Locally

First, Connect to your `meta` cluster and make sure both the new cluster is registered with
a score of `0`.

Then, Make `ws-manager-bridge` accessible:

```bash
kubectl port-forward deployment/ws-manager-bridge 8080
```

Also, Make prometheus accessible:

```bash
kubectl -n monitoring-satellite port-forward prometheus-k8s-0 9090
```

Now, Run the job:

```bash
OLD_CLUSTER="<xyz>" NEW_CLUSTER="<abc>" go run .
```
