# Terraform setup for AWS Single-cluster Gitpod reference architecture

This directory has terraform configuration necessary to achieve a infrastructure
corresponding to the [Single-cluster reference architecture for Gitpod on AWS](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch).

This module will do the following steps:
- Creates the infrastructure using our [`eks` terraform module](../../modules/eks/), which does:
  - Setup an EKS managed cluster, along with external dependencies like database, storage and registry (if chosen)
  - Sets up route53 entries for the domain name (if chosen)
- Provisioning the cluster:
  - Set up cert-manager using our [`cert-manager` module](../../modules/tools/cert-manager/)
  - Set up external-dns using our [`external-dns` module](../../modules/tools/external-dns/)
  - Creates a cluster-issuer using our [`issuer` module](../../modules/tools/issuer/)

> 💡 If you would like to create the infrastructure orchestrating the terraform modules by yourself, you can find all the modules we support [here](../../modules/).

Since the entire setup requires more than one terraform target to be run due to
dependencies (eg: helm provider depends on kubernetes cluster config, which is
not available until the `eks` module finishes), this directory has a `Makefile`
with targets binding together targeted terraform calls. This document will
explain the execution of the terraform module in terms of these `make` targets.

## Requirements

* `terraform` >= `v1.1.0`
* `kubectl`   >= `v1.20.0`
* [`jq`](https://stedolan.github.io/jq/download/)

## Setup AWS authentication and s3 backend storage

create IAM, set env vars, create backend bucket

Before starting the installation process, you need:

* An AWS account with Administrator access
  * [Create one now by clicking here](https://aws.amazon.com/getting-started/)
* Setup credentials to be usable in one of the following ways:
  * [As environmental variables](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
    * Copy the file `.env_sample` to `.env` and update the values corresponding
      to your AWS user. Run:
      ```sh
      source .env
      ```
  * [As credentials file](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
* Create and configure s3 bucket for terraform backend
  * Create an [AWS S3 bucket](https://aws.amazon.com/s3/) to store the terraform backend state
  * Replace the name of the bucket in [`main.tf`](./main.tf) - currently it is set as `gitpod-tf`

## Update the `terraform.tfvars` file with appropriate values

The file [`terraform.tfvars`](./terraform.tfvars) with values that will be used
by terraform to create the cluster. While some of them are fairly
straightforward like the name of the cluster(`cluster_name`), others need a bit
more attention:

### VPC CIDR IP

It is necessary to ensure that the `VPC` setup will not have conflicts with
existing VPCs or has sufficiently large enough IP range so as to not run out of
them. Please check under the region's VPCs if the IP range you are choosing is
already in use. The CIDR will be split among 5 subnets and hence we recommend
`/16` as prefix to allow sufficient IP ranges. The default value is: `10.100.0.0/16`

### External database, storage and registry backend

If you wish to create cloud specific database, storage and registry backend to be used
with `Gitpod`, leave the following 3 booleans set:

``` sh
enable_external_database                     = true
enable_external_storage                      = true
enable_external_storage_for_registry_backend = true
```

The corresponding resources will be created by the terraform script which
inclustes an `RDS` mysql database, an `S3` bucket and another `S3` bucket to
be used as registry backend. By default `enable_external_storage_for_registry_backend`
is set to `false`. One can re-use the same `S3` bucket for both object storage and registry backend.

The expectation is that you can use the credentials to these setups(provided later

### AMI Image ID and Kubernetes version

We officially support Ubuntu images for Gitpod setup. In EKS cluster, AMI images
are kubernetes version and region specific. You can find a list of AMI IDs
[here](https://cloud-images.ubuntu.com/docs/aws/eks/).

Make sure you provide the corresponding kubernetes version as a value to the
variable `cluster_version`. We officially support kubernetes versions >= `1.20`.

### Domain name configuration

If you are already sure of the domain name under which you want to setup Gitpod,
we recommend highly to provide the value as `domain_name`. This will save a lot
of hassle in setting up `route53` records to point to the cluster and
corresponding TLS certificate requests.

## Initialize terraform backend and confirm the plan

> ⚠️  We ship 4 terraform modules here and some of them have dependencies among each other (eg: `cert-manager` module depends on `eks` module for `kubeconfig`, or the `cluster-issuer` module depends on `cert-manager` for the CRD). Hence a simple run of `terraform plan` or `terraform apply` may lead to errors. Hence we wrap [targeted `terraform` operations](https://learn.hashicorp.com/tutorials/terraform/resource-targeting) in the following make targets. If you wish you use `terraform` commands instead, please make sure you look into the Makefile to understand the target order.


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

The `apply` target calls the `terraform` apply on `eks` module, `cert-manager`
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
the terraform module registers the module with `route53` to point to the
cluster. Now you have to configure whichever provider you use to host your
domain name to route traffic to the AWS name servers. You can find these name
servers in the `make output` command from above. It would be of the format:

```json
Nameservers for the domain(to be added as NS records in your domain provider):
=================
[
  "ns-1444.awsdns-52.org.",
  "ns-1559.awsdns-02.co.uk.",
  "ns-209.awsdns-26.com.",
  "ns-969.awsdns-57.net."
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
documentaion](https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod) to complete the Gitpod setup.

## Troubleshooting

### KOTS pods fail to deploy

Sometimes, the pods deployed when executing `kubectl kots install gitpod` fail to deploy due to issues with mounting their disks:

```$ kubectl get pods -A
NAMESPACE      NAME                                       READY   STATUS              RESTARTS   AGE
gitpod         kotsadm-minio-0                            0/1     ContainerCreating   0          2m28s
gitpod         kotsadm-postgres-0                         0/1     Init:0/2            0          2m28s
```

This can happen when the wrong `image_id`  was used in the `.tfvars` file. The ID needs to respect both the region as well as the Kubernetes version and can be found [here](https://cloud-images.ubuntu.com/docs/aws/eks/).

### Some pods never start (Init state)

```sh
kubectl get pods -l component=proxy
NAME                     READY   STATUS    RESTARTS   AGE
proxy-5998488f4c-t8vkh   0/1     Init 0/1  0          5m
```

The most likely reason is that the DNS01 challenge has yet to resolve. To fix this, make sure you have added the NS records corresponding to the `route53` zone of the `domain_name` added to your domain provider.

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
aws eks --region <regon> update-kubeconfig --name <cluster_name>
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
