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

To initiate the deployment run the following commands:

```console
git clone https://github.com/gitpod-io/gitpod
cd gitpod/chart

helm repo add charts.gitpod.io https://charts.gitpod.io
helm repo add stable https://charts.helm.sh/stable
helm repo add stable https://helm.min.io/
helm repo update
helm dep up

helm install gitpod .
```

 > Review the deployment worked properly by running `kubectl get pods`. Eventually all pods should be up-and-running. In case they are not have a look the the [Troubleshooting Guide](./troubleshooting.md)
 
 1. Configure [ingress into the cluster](../configure-ingress/)

 2. Go to https://123-123-123-123.ip.mygitpod.com/workspace and follow the steps to setup OAuth

## Recommended Configuration

Without further configuration the Helm chart installs a working Gitpod installation in a lot of scenarios.
Yet, there are certain things you want to review when installing Gitpod for long term use or a bigger audience:
* [**Database**](../database/): Configure where Gitpod stores all internal runtime data.
* [**Storage**](../storage/): Configure where Gitpod persists workspace content.
* [**Docker Registry**](../docker-registry/): Configure where Gitpod stores workspace images that are build at runtime.

## Customization

Further customizations:
* [**Kubernetes Nodes**](../nodes/): Configure file system layout and the workspace's node associativity.
* [**Workspaces**](../workspaces/): Configure workspace sizing.
