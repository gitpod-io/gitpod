# Terraform setup for AKS Single-cluster Gitpod reference architecture

This directory has terraform configuration necessary to achieve a infrastructure
corresponding to the Single-cluster reference architecture for Gitpod on Azure.

This module will do the following steps:
- Creates the infrastructure using our [`aks` terraform module](../../modules/aks/), which does:
  - Setup an AKS managed cluster, along with external dependencies like database, storage and registry (if chosen)
  - Sets up Azure Cloud DNS entries for the domain name (if chosen)
- Provisioning the cluster:
  - Set up cert-manager using our [`cert-manager` module](../../modules/tools/cert-manager/)
  - Set up external-dns using our [`external-dns` module](../../modules/tools/external-dns/)
  - Creates a cluster-issuer using our [`issuer` module](../../modules/tools/issuer/)

> 💡 If you would like to create the infrastructure orchestrating the terraform modules by yourself, you can find all the modules we support [here](../../modules/).

Since the entire setup requires more than one terraform target to be run due to
dependencies (eg: helm provider depends on kubernetes cluster config, which is
not available until the `aks` module finishes), this directory has a `Makefile`
with targets binding together targeted terraform calls. This document will
explain the execution of the terraform module in terms of these `make` targets.

## Requirements

* `terraform` >= `v1.1.0`
* `kubectl`   >= `v1.21.0`
* [`jq`](https://stedolan.github.io/jq/download/)

## Setup Azure authentication and `azurerm` backend storage

Before starting the installation process, you need:
* An Azure account
  - [Create one now by clicking here](https://azure.microsoft.com/en-gb/free/)
- A user account with "Owner" IAM rights on the subscription
* Create and configure Azure Blob storage account for terraform backend
  * Create an [Azure blob storage account](https://azure.microsoft.com/en-in/services/storage/blobs/) and a container inside it to store terraform backend state
  * Create an Access Key for the said Blob storage account, [as descibed in the terraform doc](https://www.terraform.io/language/settings/backends/azurerm)
  * Replace the name of the `storage_account_name`, `container_name`, `resource_group_name`, and (optionally) `key` in [`main.tf`](./main.tf)
* Add an `.env` file with all necessary credentials.
  * An `.env_sample` is included, copy the file `.env_sample` to `.env`
  * Update the values of the variables and run:
    ```sh
    source .env
    ```

## Update the `terraform.tfvars` file with appropriate values

The file [`terraform.tfvars`](./terraform.tfvars) with values that will be used
by terraform to create the cluster. While some of them are fairly
straightforward like the name of the Azure resource group(`resource_group_name`), others need a bit more attention:

### External database, storage and registry backend

If you wish to create cloud specific database, storage and registry to be used
with `Gitpod`, leave the following 3 booleans set:

``` sh
create_external_database = true
create_external_storage  = true
create_external_registry = true
```

The corresponding resources will be created by the terraform script which
includes a mysql database, a Azure block storage account and an Azure container registry

### Kubernetes version

Make sure you provide an [Azure supported Kubernetes version](https://docs.microsoft.com/en-us/azure/aks/supported-kubernetes-versions) as a value to the
variable `cluster_version`. Please see the [Gitpod Compatibility Matrix](https://www.gitpod.io/docs/references/product-compatibility-matrix?admin) for officially supported Kubernetes versions.

### Domain name configuration

If you are already sure of the domain name under which you want to setup Gitpod,
we recommend highly to provide the value as `domain_name`. This will save a lot
of hassle in setting up Azure cloudDNS records to point to the cluster and
corresponding TLS certificate requests.

## Initialize terraform backend and confirm the plan

> ⚠️  We ship 4 terraform modules here and some of them have dependencies among each other (eg: `cert-manager` module depends on `aks` module for `kubeconfig`, or the `cluster-issuer` module depends on `cert-manager` for the CRD). Hence a simple run of `terraform plan` or `terraform apply` may lead to errors. Hence we wrap [targeted `terraform` operations](https://learn.hashicorp.com/tutorials/terraform/resource-targeting) in the following make targets. If you wish you use `terraform` commands instead, please make sure you look into the Makefile to understand the target order.

* Initialize the terraform backend with:

  ``` sh
  make init
  ```

* Get the plan of the execution to verify the resources that are going to get
  created:

  ```sh
  make plan
  ```

## Apply terraform setup

If the plan looks good, now you can go ahead and create the resources:

``` sh
make apply
```

The `apply` target calls the `terraform` apply on `aks` module, `cert-manager`
module, `external-dns` module and `cluster-issuer` module in that exact order.
The entire operation would take around *30 minutes* to complete.

Upon completion, you will find a creation `kubeconfig` file in the local
directory. You can try accessing the cluster using this file as follows:

``` sh
export KUBECONFIG=/path/to/kubeconfig
kubectl get pods -A
```

You can list all the other outputs with the following command:

``` sh
make output
```

> 💡 Alternatively, you can get the simple JSON output with a `terraform output` command

## Note the NS records from terraform output

Once the apply process has exited successfully, we can go ahead and prepare to
setup Gitpod. If you specified the `domain_name` in the `terraform.tfvars` file,
the terraform module registers the domain with Azure cloudDNS  point to the
cluster. Now you have to configure whichever provider you use to host your
domain name to route traffic to the Azure name servers. You can find these name
servers in the `make output` command from above. It would be of the format:

```json
Nameservers for the domain(to be added as NS records in your domain provider):
=================
[
  "ns1-35.azure-dns.com.",
  "ns2-35.azure-dns.net.",
  "ns3-35.azure-dns.org.",
  "ns4-35.azure-dns.info."
]
```

Add the `ns` records similar to the above 4 URIs as NS records under your domain
DNS management setup. Check with your domain hosting service for specific information.

## Note the dependency credentials from terraform output

If you enabled the creation of external database, storage and registry, the
above `make output` command would list the credentials to connect to the
corresponding resource. Make a note of this, so as to provide the same when
setting up Gitpod via KOTS UI.

## Install Gitpod

You can install `KOTS` CLI to install Gitpod:

``` sh
curl https://kots.io/install | bash
```

Run the following to get started with Gitpod installation:

``` sh
export KUBECONFIG=kubeconfig
kubectl kots install gitpod/stable # you can replace `stable` with `unstable` or `beta` as per the requirement
```

Upon completion, you can access `KOTS` UI in `localhost:8800`. Here you can
proceed to configuring and intalling Gitpod. Please follow the [official
documentation](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod) to complete the Gitpod setup.

## Troubleshooting

### Some pods never start (Init state)

```sh
kubectl get pods -l component=proxy
NAME                     READY   STATUS    RESTARTS   AGE
proxy-5998488f4c-t8vkh   0/1     Init 0/1  0          5m
```

The most likely reason is that the DNS01 challenge has yet to resolve. To fix this, make sure you have added the NS records corresponding to the Azure cloudDNS zone of the `domain_name` added to your domain provider.

Once the DNS record has been updated, you will need to delete all Cert Manager pods to retrigger the certificate request

```
kubectl delete pods -n cert-manager --all
```

After a few minutes, you should see the https-certificate become ready.

```
kubectl get certificate
NAME                        READY   SECRET                      AGE
https-certificates          True    https-certificates          5m
```

### Cannot connect to the created cluster after a while

There is a chance that your kubeconfig has gotten expired after a specific amount of time. You can reconnect to the cluster by using:

``` sh
az login --service-principal -u $ARM_CLIENT_ID -p $ARM_CLIENT_SECRET --tenant $ARM_TENANT_ID
az aks get-credentials --name <resource_group_name>-cluster --resource-group <resource_group_name> --file kubeconfig
```

## Cleanup

Make sure you first delete the `gitpod` resources in the cluster so things like load balancer created by the k8s `service` gets deleted. Otherwise terraform will not be able to delete the VPC.

```sh
kubectl delete --now namespace gitpod
```

> It is okay to ignore any dangling workspaces that are not deleted

Now run the terraform destroy step to cleanup all the cloud resources:

```sh
make destroy
```

The destroy should take around 20 minutes.
