---
url: /docs/self-hosted/latest/install/install-on-kubernetes/
---

# Install Gitpod Self-Hosted on Kubernetes

This section describes how to install Gitpod on any Kubernetes cluster.
Gitpod also provides more optimized installations offering better performance for particular cloud providers:
* *Google Cloud Platform*: Install Gitpod in a blank GCP project [using a script that automates the procedure](../install-on-gcp-script/).
* *AWS*: Install Gitpod on AWS [using a script that automates the procedure](../install-on-aws-script/).

Gitpod is installed using [Helm](https://helm.sh).
The source of the chart can be found [here](https://github.com/gitpod-io/gitpod/blob/master/chart/).
Releases are published at https://charts.gitpod.io.

## Prerequisites
 1. Kubernetes version 1.15 <= x <= 1.17 is supported

 > Note: Gitpod should work on small nodes out of the box (2vCPUs, 8GB RAM). For a solid experience we recommend at least 4vCPUs and 16GB RAM for workspaces nodes.

## Installation

To initiate the deployment run the following commands:
```console
helm repo add gitpod.io https://charts.gitpod.io

helm install gitpod gitpod.io/gitpod
```

 > Review the deployment worked properly by running `kubectl get pods`. Eventually all pods should be up-and-running. In case they are not have a look the the [Troubleshooting Guide](../troubleshooting/)
 
 1. Configure [ingress into the cluster](../configure-ingress/).
    It makes sense to create a new folder for all Gitpod specific custom configuration and files:
    ```
    mkdir gitpod && cd gitpod
    ```
 2. Go to [https://\<your-domain.com\>](https://\<your-domain.com\>) and follow the steps to complete the installation.

## Recommended Configuration

Without further configuration the Helm chart installs a working Gitpod installation in a lot of scenarios.
Yet, there are certain things you might want to review when installing Gitpod for long term use and/or a bigger audience:
* [**Database**](../database/): Configure where Gitpod stores all internal runtime data.
* [**Storage**](../storage/): Configure where Gitpod persists workspace content.
* [**Docker Registry**](../docker-registry/): Configure where Gitpod stores workspace images that are build at runtime.

## Customization

Further customizations:
* [**Kubernetes Nodes**](../nodes/): Configure file system layout and the workspace's node associativity.
* [**Workspaces**](../workspaces/): Configure workspace sizing.
