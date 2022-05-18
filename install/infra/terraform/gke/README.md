# GKE terraform module

This is a terraform module currently used in the automated installation tests
for Gitpod. At successful completion, this module creates the following:

1. A [`GKE`](https://cloud.google.com/kubernetes-engine) cluster by user
   provided name `<name>` with the following nodepools:
   1. `workspaces-<name>` for workspace workloads
   1. `services-<name>` for IDE and meta workloads
1. A dedicated `vpc` and `subnet` for the resources
1. `kubeconfig` data populated in a user defined `kubeconfig` variable

## Requirements

1. `terraform` >= `v1.1.7`

## Providers

1. [`google`](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

## Inputs


| Argument                  | Description                                                                                                                                  | Required | Default            |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|----------|--------------------|
| `project`                 | The project ID to create the cluster.                                                                                                        | `true`   |                    |
| `kubeconfig`              | Path to write the kubeconfig output to.                                                                                                      | `false`  | `./kubeconfig`     |
| `region`                  | The region to create the cluster.                                                                                                            | `true`  | |
| `zone`                    | The zone to create the cluster in. Eg. `europe-west1-b`. If not provided, it will create a regional(high-availability) cluster| `false`  | null                |
| `kubernetes_version`      | Kubernetes version to be setup                                                                                                               | `false`  | `1.22.8-gke.201` |
| `name`                    | The name of the cluster and suffix for other resources                                                                                       | `false`  | `gitpod`          |
| `workspaces_machine_type` | Type of the node compute engines for workspace nodepool.                                                                                     | `false`  | `n2-standard-8`    |
| `services_machine_type`   | Type of the node compute engines for meta and IDE nodepool.                                                                                  | `false`  | `n2-standard-4`    |
| `max_count`               | Maximum number of nodes in the NodePool. Must be >= min_node_count.                                                                          | `false`  | `50`               |
| `disk_size_gb`            | Disk size to provision in nodes.                                                                                                             | `false`  | `100`              |
| `credentials`             | Path to the JSON file storing Google service account credentials, if left empty, `tf` will look for `GOOGLE_APPLICATION_CREDENTIALS` env var | `false`  |                    |


## Outputs


| Argument              |
|-----------------------|
| `kubernetes_endpoint` |
| `client_token`        |
| `ca_certificate`      |
| `kubeconfig`          |


## Usage

Make sure you have a `GCP` account and credentials in `JSON` format to a service
account with atleast the following permissions:
1. Compute Admin
1. Compute Network Admin
1. Kubernetes Engine Admin
1. Kubernetes Engine Developer
1. Service Account User
1. Storage Admin

Assign it to the following environment variable:

``` sh
export GOOGLE_APPLICATION_CREDENTAILS=/path/to/service-account-json-creds
```

Create a `Cloud storage bucket` in the same project and region and specified
above, by name `gitpod-gke`. If you want to use a different name, edit the name
manually in the `main.tf` file.

Run the following commands:

``` sh
terraform init
terraform apply # provide the values that are prompted for
```


## Cleanup

``` sh
terraform destroy
```
