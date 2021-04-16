# blowtorch

blowtorch is a tool to selectively burn down bridges, i.e. Kubernetes service connections by injecting a [toxiproxy](github.com/Shopify/toxiproxy).

**Note:** this is a development tool only - there's no support for it.

## Usage

```
blowtorch helps using toxiproxy to create network chaos in your k8s application

Usage:
  blowtorch [command]

Available Commands:
  ablaze      Adds a toxiproxy intermediate for a random service, adds some random toxics and restarts all pods
  help        Help about any command
  inject      Adds a toxiproxy intermediate for a particular service
  remove      Removes a previously injected toxiproxy
  revert      Revert removes a previously injected toxiproxy

Flags:
  -h, --help                help for blowtorch
      --kubeconfig string   path to the kubeconfig file (defaults to $HOME/.kube/config) (default "/home/gitpod/.kube/config")
  -t, --toggle              Help message for toggle

Use "blowtorch [command] --help" for more information about a command.
```