---
url: /docs/self-hosted/latest/install/install-on-kubernetes/
---

# Install Gitpod Self-Hosted on Kubernetes

This section describes how to install Gitpod on any Kubernetes cluster using [Helm](https://helm.sh). This is the most flexible and generic way of installing Gitpod. The chart for stable releases resides in Helm repository [charts.gitpod.io](https://charts.gitpod.io), charts for branch-builds can be found [here](#install-branch-build), and the source of the charts is in our [public git repository](https://github.com/gitpod-io/gitpod/blob/master/chart/).

For some platforms we offer [Terraform](https://www.terraform.io/) scripts that ease the infrastructure setup. Once the script has created the necessary infrastructure it will output a `values.terraform.yaml` that contains infrastructure-specific configuration for the `helm` deployment.
* [Terraform for Google Cloud Platform (GCP)](../install-on-gcp/).

## Prerequisites

As we at Gitpod follow a ["Saas First" strategy](https://www.notion.so/gitpod/Gitpod-s-Direction-be35d064c0704fbda61c542b84e07ef6#57d3e4659c50449280411ac1f7dd1906) we have a [very limited set of platforms that we support](https://www.notion.so/gitpod/1b9eac5cb33d42e391f86a87f0e37836?v=4f2ec7c943514ee19203b9d4fe096094).

You still might get Gitpod to run on other platforms (especially with the help of our [awesome community](https://community.gitpod.io/)) but there will be no support from Gitpod for those efforts.

Requirements regarding the Kubernetes the cluster:
  * Workspace nodes require Ubuntu `= 18.04` as Host OS at the moment

  * Gitpod should work on small Kubernetes nodes out of the box (2vCPUs, 8GB RAM). For a better experience we recommend at least 4vCPUs and 16GB RAM for workspaces nodes. For cost efficiency, we recommend to enable cluster-autoscaling.

You need the following "local" tools to follow this guide:

 * `kubectl` with connection to your cluster

 * `helm` in version `>= 3`.

## Installation

To install Gitpod in your Kubernetes cluster, follow these steps:

1. Create a file `values.custom.yaml` with the following content:
   ```
   rabbitmq:
     auth:
       username: your-rabbitmq-user
       password: your-secret-rabbitmq-password
   minio:
     accessKey: your-random-access-key
     secretKey: your-random-secret-key
   ```
   You should replace the keys with 2 different random strings unique for your installation.

1. Run the following commands in your local terminal:
    ```console
    helm repo add gitpod.io https://charts.gitpod.io

    helm install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.9.0
    ```

1. Configure [domain and https](../configure-ingress/).

1. Run `kubectl get pods` and verify that all pods are in state `RUNNING`. If some are not, please see the [Troubleshooting Guide](../troubleshooting/).

1. Go to [https://\<your-domain.com\>](https://\<your-domain.com\>) and follow the steps to complete the installation.


## Upgrade

 1. Check the [Upgrade Guide](../upgrade/) and follow the steps outlined there.

 1. Run the update
    ```console
    helm install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.9.0
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