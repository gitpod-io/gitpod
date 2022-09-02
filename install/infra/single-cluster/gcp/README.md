# Terraform setup for GCP Single-cluster Gitpod reference architecture

This directory has terraform configuration necessary to achieve a infrastructure
corresponding to the [Single-cluster reference architecture for Gitpod on GCP](https://www.gitpod.io/docs/self-hosted/latest/reference-architecture/single-cluster-ref-arch).

This module will do the following steps:
- Creates the infrastructure using our [`gke` terraform module](../../modules/gke/), which does:
  - Setup an GKE managed cluster, along with external dependencies like database, storage and registry (if chosen)
  - Sets up `CloudDNS` entries for the domain name (if provided)
- Provisioning the cluster:
  - Set up cert-manager using our [`cert-manager` module](../../modules/tools/cert-manager/)
  - Set up external-dns using our [`external-dns` module](../../modules/tools/external-dns/)
  - Creates a cluster-issuer using our [`issuer` module](../../modules/tools/issuer/)

> 💡 If you would like to create the infrastructure orchestrating the terraform modules by yourself, you can find all the modules we support [here](../../modules/).


Since the entire setup requires more than one terraform target to be run due to
dependencies (eg: helm provider depends on kubernetes cluster config, which is
not available until the `gke` module finishes), this directory has a `Makefile`
with targets binding together targeted terraform calls. This document will
explain the execution of the terraform module in terms of these `make` targets.

## Requirements

* `terraform` >= `v1.1.0`
* `kubectl`   >= `v1.20.0`
* [`jq`](https://stedolan.github.io/jq/download/)
* [`gcloud`](https://cloud.google.com/sdk/docs/install)

## Setup GCP authentication and GCS backend storage

Before starting the installation process, you need:

* A GCP account with administative access
  * [Create one now by clicking here](https://console.cloud.google.com/freetrial)
* Store the JSON credentials corresponding to the service account locally in a file
* Create and configure GCS bucket for terraform backend
  * Create a [GCS bucket](https://cloud.google.com/storage) to store the terraform backend state
  * Replace the name of the bucket in [`main.tf`](./main.tf) - currently there is this placeholder there `<gcs-bucket-name>`
* Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS` to point to the downloaded JSON key of the service account to authenticate terraform:
  ```
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/account/key.json
  ```

## Update the `terraform.tfvars` file with appropriate values

The file [`terraform.tfvars`](./terraform.tfvars) with values that will be used
by terraform to create the cluster. While some of them are fairly
straightforward like the name of the cluster(`cluster_name`), others need a bit
more attention:

### Project configuration

To configure against a standing GCP account, we expect the the key corresponding
to the service account stored as a JSON file. The path to the JSON file is
expected to be set as value to the environment variable `GOOGLE_APPLICATION_CREDENTIALS` as explained above.
Alongside, one is
expected to provide the name of the project(`project` field) corresponding to
this service account and region in with the cluster is to be created(`region`
field). If you want your cluster to be zonal(only existing in one zone), you can
provide a zone corresponding to the project(`zone` field), else the cluster will
be regional.

### External database, storage and registry

If you wish to create cloud specific database, storage and registry backend to be used
with `Gitpod`, leave the following 3 booleans set:

``` sh
enable_external_database                     = true
enable_external_storage                      = true
enable_external_registry                     = true
```

The corresponding resources will be created by the terraform script which
creates an `CloudSQL` mysql database, and access credentials to the GCS storage and GCR registry.

The expectation is that you can use the credentials to these setups(provided later
as terraform outputs) during the setup of Gitpod via UI later in the process.
Alternatively, one can choose to use incluster dependencies or separately
created resources of choice.

### Kubernetes version

Make sure you provide the corresponding kubernetes version as a value to the
variable `cluster_version`. We officially support kubernetes versions >= `1.20`.

### Domain name configuration

If you do not yet have a DNS zone created for Gitpod or plan on using cert-manager
to generate TLS certificates for gitpod, we strongly recommend setting `domain_name`
to a domain for use with Gitpod. This will save a lot
of hassle in setting up `Cloud DNS` records to point to the cluster and
corresponding TLS certificate requests.

## Initialize terraform backend and confirm the plan

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
the terraform module registers the module with `cloudDNS` to point to the
cluster. Now you have to configure whichever provider you use to host your
domain name to route traffic to the GCP name servers. You can find these name
servers in the `make output` command from above. It would be of the format:

```json
Nameservers for the domain(to be added as NS records in your domain provider):
=================
[
  "ns-cloud-c1.googledomains.com.",
  "ns-cloud-c2.googledomains.com.",
  "ns-cloud-c3.googledomains.com.",
  "ns-cloud-c4.googledomains.com."
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

### Some pods never start (Init state)

```sh
kubectl get pods -l component=proxy
NAME                     READY   STATUS    RESTARTS   AGE
proxy-5998488f4c-t8vkh   0/1     Init 0/1  0          5m
```

The most likely reason is that the DNS01 challenge cannot be completed, typically because DNS zone delegation hasn't been set up from the parent domain to the subdomain that Gitpod is managing (specified by the `domain_name` variable). To fix this, make sure that NS records for `domain_name` in the parent zone are created and point to the nameservers of the Gitpod managed zone. See the [Google Cloud DNS documentation](https://cloud.google.com/dns/docs/dns-overview#delegated_subzone) for more information on zone delegation.

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
# make sure you are authenticated using the service account you used to create the cluster
gcloud auth activate-service-account --key-file=/path/to/account/key.json
gcloud container clusters get-credentials <cluster_name> --region <region> --zone <zone> --project <project>
```

### Failed to install helm charts to the cluster

If you see errors like:

```
Error: clusterroles.rbac.authorization.k8s.io is forbidden: User "xxxxx@developer.gserviceaccount.com" cannot create resource "clusterroles" in API group "rbac.authorization.k8s.io" at the cluster scope: requires one of ["container.clusterRoles.create"] permission(s).
│
│   with module.certmanager.helm_release.cert,
│   on ../../modules/tools/cert-manager/main.tf line 17, in resource "helm_release" "cert":
│   17: resource "helm_release" "cert" {
│
```
After running `make apply`, ensure that the service account you are using has the `Kubernetes Engine Admin` role. See the [GCP IAM documentation](https://cloud.google.com/iam/docs/granting-changing-revoking-access) to learn how to associate roles with a service account.

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
