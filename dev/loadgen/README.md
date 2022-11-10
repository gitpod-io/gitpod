# loadgen

A load generator (framework) for Gitpod.

**Note:** this is a development tool only - there's no support for this.

You can find a short explanation of this tool in this [loom video](https://www.loom.com/share/6487e3403c0746cc97bb3f766e15fab6).

## How to run a benchmark
- Ensure your kubeconfig has the configuration for the cluster you want to benchmark. You can use kubecdl to update your kubeconfig with the cluster information
  ```console
  $ kubecdl -p workspace-clusters [cluster-name]
  $ kubectx [cluster-name]
  ```
- Fetch the TLS config from ws-manager
  ```console
  gpctl clusters get-tls-config
  ```
- Port-forward ws-manager
  ```console
  kubectl port-forward deployment/ws-manager 12001:8080
  ```
- Compile loadgen
  ```console
  cd ./dev/loadgen
  go build .
  ```
- Now you can start the benchmark with loadgen. If you want to keep the workspaces around after testing, add `--interactive`. Loadgen will then ask you before taking any destructive action. If you do not specify `--interative` loadgen will wait 2 minutes before workspaces are deleted. The config file located at the `./dev/loadgen/configs` folder.
  ```console
  ./loadgen benchmark [config-file] --host localhost:12001 --tls ./wsman-tls --interactive
  ```

In order to configure the benchmark, you can use the configuration file

| Parameter  | Description |
| ------------- | ------------- |
| workspaces  | The number of workspaces that will be started during the benchmark |
| ideImage  | The image that will be used for the IDE |
| waitForRunning | How long to wait for workspaces to enter running state |
| waitForStopping | How long to wait until all workspaces are stopped |
| successRate | Percentage of started workspaces that should enter running state to count as a successful run |
| environment | Global environment variables that will be set for all repositories |
| workspaceClass | The workspace class to use for workspaces. This setting can be overriden for individual repositories |
| workspaceTimeout | The workspace timeout value |
| repoAuth | The authentication for a repository. This setting can be overriden for individual repositories |
| repoAuth.authUser | The user that should be used for authentication |
| repoAuth.authPassword | The password that should be used for authentication |
| featureFlags | The feature flag passed when creating the workspace |
| repos | The repositories that will be used to create workspaces |
| repo.cloneURL | The url of the repository |
| repo.cloneTarget | The branch to clone from |
| repo.score | The score decides how often a repository is used for the creation of a workspace |
| repo.workspaceImage | The docker image that will be used for the workspace |
| repo.environment | Environment variables that will only be set for this repository |
| repo.workspaceClass | The workspace class to use for the workspace that will be created for this repository |
| repo.auth | The authentication for the repository |
| repo.auth.authUser | The user that should be used for authentication |
| repo.auth.authPassword | The password that should be used for authentication |

After the benchmark has completed, the command will print where the results are stored (this will be a `benchmark-result.json` file inside a unique directory under `results/`). This results file contains information about every started workspace.

```
[
  {
    "WorkspaceName": "moccasin-lynx-aqjtmmi4",
    "InstanceId": "d25c1a63-0319-4ecc-881d-68804a0d1e4a",
    "Phase": 4,
    "Class": "default",
    "NodeName": "workspace-ws-ephemeral-fo3-pool-wtcj",
    "Pod": "ws-d25c1a63-0319-4ecc-881d-68804a0d1e4a",
    "Context": "https://github.com/gitpod-io/template-python-flask"
  },
  {
    "WorkspaceName": "black-wren-lqa4698w",
    "InstanceId": "95f24d47-8c0c-4249-be24-fcc5d4d7b6fb",
    "Phase": 4,
    "Class": "default",
    "NodeName": "workspace-ws-ephemeral-fo3-pool-wtcj",
    "Pod": "ws-95f24d47-8c0c-4249-be24-fcc5d4d7b6fb",
    "Context": "https://github.com/gitpod-io/template-python-django"
  },
  ...
```
