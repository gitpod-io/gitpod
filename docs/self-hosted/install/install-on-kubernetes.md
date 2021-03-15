---
url: /docs/self-hosted/latest/install/install-on-kubernetes/
---

# Install Gitpod Self-Hosted on Kubernetes

This section describes how to install Gitpod on any Kubernetes cluster using [Helm](https://helm.sh). This is the most flexible and generic way of installing Gitpod. The chart for stable releases resides in Helm repository [charts.gitpod.io](https://charts.gitpod.io), charts for branch-builds can be found [here](#install-branch-build), and the source of the charts is in our [public git repository](https://github.com/gitpod-io/gitpod/blob/master/chart/).

For some cloud providers, we offer [Terraform](https://www.terraform.io/) scripts packaged into an installer. The installer aims to use the managed services from your cloud provider (Kubernetes Cluster, database, storage, image registry) rather than installing them along with the chart. Also, the script configures the cluster for best performance and cost-efficiency. We recommend using the installer if your cloud provider is supported. Once the installer has created the cluster, it will pre-configure and install this Gitpod helm chart into it.
* [Installer for Google Cloud Platform (GCP)](../install-on-gcp-script/).
* [Installer for Amazon Web Services (AWS)](../install-on-aws-script/).

## Prerequisites

 * A Kubernetes cluster in version 1.15 <= x <= 1.17.

 * local `kubectl` with connection to your cluster

 * local `helm` in version >= 3.

 Gitpod should work on small Kubernetes nodes out of the box (2vCPUs, 8GB RAM). For a better experience we recommend at least 4vCPUs and 16GB RAM for workspaces nodes. For cost efficiency, we recommend to enable cluster-autoscaling.

## Installation

To install Gitpod in your Kubernetes cluster, follow these steps:

1. Create a file `values.custom.yaml` with the following content:
   ```
   minio:
     accessKey: your-random-access-key
     secretKey: your-random-secret-key
   ```
   You should replace the keys with 2 different random strings unique for your installation.

1. Run the following commands in your local terminal:
    ```console
    helm repo add gitpod.io https://charts.gitpod.io

    helm install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0
    ```

1. Configure [domain and https](../configure-ingress/).

1. Run `kubectl get pods` and verify that all pods are in state `RUNNING`. If some are not, please see the [Troubleshooting Guide](../troubleshooting/).

1. Go to [https://\<your-domain.com\>](https://\<your-domain.com\>) and follow the steps to complete the installation.


## Upgrade

 1. Check the [Upgrade Guide](../upgrade/) and follow the steps outlined there.

 1. Run the update
    ```console
    helm install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0
    ```

 1. Run `kubectl get pods` and verify that all pods are in state `RUNNING`. If some are not, please see the [Troubleshooting Guide](../troubleshooting/).


## Recommended Configuration

By default, the Helm chart installs a working Gitpod installation in a lot of scenarios. Yet, there are certain things you might want to review when installing Gitpod for long term use and/or a bigger audience:
* [**Database**](../database/): Configure where Gitpod stores all internal runtime data.
* [**Storage**](../storage/): Configure where Gitpod persists workspace content.
* [**Docker Registry**](../docker-registry/): Configure where Gitpod stores workspace images.

## Customization

Further customizations:
* [**Kubernetes Nodes**](../nodes/): Configure file system layout and the workspace's node associativity.
* [**Workspaces**](../workspaces/): Configure workspace sizing.

## Install Branch Build

To try the latest version of Gitpod, freshly build form the `master` branch of our git repository or any other branch, follow these steps:

1. Obtain the version name from [werft.gitpod-dev.com](https://werft.gitpod-dev.com/). The version has the format `<branchname>.<buildnumber>` (e.g  `master.354`).

2. The Helm chart ships as part of our `installer` docker image. You can extract it by running:
    ```console
    docker run --entrypoint cp -v $PWD:/workspace gcr.io/gitpod-io/self-hosted/installer:<version> -R /dist/helm/ /workspace
    ```