---
url: /docs/self-hosted/latest/install/install-on-kubernetes/
---

# Install Gitpod Self-Hosted on Kubernetes

This section describes how to install Gitpod on any Kubernetes cluster.
Gitpod also provides more optimized installations offering better performance for particular cloud providers:
* *Google Cloud Platform*: Install Gitpod in a blank GCP project [using a script that automates the procedure](../install-on-gcp-script/).
* *AWS*: Install Gitpod on AWS [using a script that automates the procedure](../install-on-aws-script/).

Gitpod is installed using [Helm](https://helm.sh). The chart can be found [here](https://github.com/gitpod-io/gitpod/blob/master/chart/).

## Installation

To perform the installation run the following commands:

```console
git clone https://github.com/gitpod-io/gitpod
cd gitpod/chart

helm repo add charts.gitpod.io https://charts.gitpod.io
helm repo add stable https://charts.helm.sh/stable
helm repo add stable https://helm.min.io/
helm repo update

helm upgrade --install $(for i in $(cat configuration.txt); do echo -e "-f $i"; done) gitpod .
```
#####TODO
## Recommended Configuration



## Customization

* [**Storage**](../storage/): Configure where Gitpod stores stopped workspaces.
* [**Kubernetes Nodes**](../nodes/): Configure file system layout and the workspace's node associativity.
* [**Workspaces**](../workspaces/): Configure workspace sizing.
