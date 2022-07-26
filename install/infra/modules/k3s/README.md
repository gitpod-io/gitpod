# k3s terraform module

This is a terraform module currently used in the automated installation tests
for Gitpod. At successful completion, this module creates the following:

1. A GCP VM instance of type `n2d-standard-4` and with `ubuntu` image, along with a service account to give auth scopes
1. A single node [`k3s`](https://k3s.io/) cluster with [`k3sup`](https://github.com/alexellis/k3sup)

### Requirements

1. `terraform` >= `v1.1.7`
1. [`k3sup`](https://github.com/alexellis/k3sup#download-k3sup-tldr)
    ```sh
    curl -sLS https://get.k3sup.dev | sh
    sudo install k3sup /usr/local/bin/
    ```

## Providers

1. [`google`](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

## Input

| Argument      | Description                                                                                                                                  | Required | Default          |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------|----------|------------------|
| `gcp_project` | The project ID to create the VM in.                                                                                                          | `true`   |                  |
| `kubeconfig`  | Path to write the kubeconfig output to.                                                                                                      | `false`  | `./kubeconfig`   |
| `gcp_region`  | The region to create the VM.                                                                                                                 | `false`  | `europe-west1`   |
| `gcp_zone`    | The GCP zone to create the VM in.                                                                                                            | `false`  | `europe-west1-b` |
| `name`        | Prefix name for the nodes and firewall                                                                                                       | `false`  | `k3s`            |
| `credentials` | Path to the JSON file storing Google service account credentials, if left empty, `tf` will look for `GOOGLE_APPLICATION_CREDENTIALS` env var | `false`  |                  |

## Output

| Argument              |
|-----------------------|
| `kubernetes_endpoint` |
| `kubeconfig`          |

## Usage

Create a service account with at least the following access scopes:
- Compute Admin
- Create Service Accounts
- Delete Service Accounts
- Service Account User
- Storage Admin

Get the credentials of the SA in `JSON` format and export as a variable as folows:

``` sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials
```
```sh
terraform init --upgrade
terraform apply # provide the values that are prompted for
```

You will find the `kubeconfig` populated to the path you specified or `./kubeconfig` by default.

## Cleanup

```sh
terraform destroy
```
