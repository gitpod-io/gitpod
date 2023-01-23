# workspace-rollout-job

`workspace-rollout-job` performs a rollout from one workspace cluster to another while monitoring
metrics.

## Running Locally

First, Connect to your `application` cluster and make sure the new cluster is
registered with a score of `0`.

Then, Make sure `kubeconfig` for the application cluster is available
along with permissions to port-forward. (Follow ./hack/ws-rollout-job.yaml for an example)

Also, Make prometheus accessible:

```bash
kubectl -n monitoring-satellite port-forward prometheus-k8s-0 9090
```

Now, Run the job:

```bash
go run . --old-cluster <abc> --new-cluster <xyz> --prometheus-url <>
```

Rollout progress can either be monitored through logs or by metrics at `localhost:9500/metrics`
