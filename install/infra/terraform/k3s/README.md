## Module to create a 1 node k3s cluster in GCP

### Requirements

- `terraform` >= 1.0.0
- [`k3sup`](https://github.com/alexellis/k3sup#download-k3sup-tldr)
    ```sh
    curl -sLS https://get.k3sup.dev | sh
    sudo install k3sup /usr/local/bin/
    ```

### Usage

Update the `tfvars` file by the name `variables.auto.tfvars` in this
directory with the values you want, and then run:

```sh
terraform init --upgrade
terraform apply
```

You will find the `kubeconfig` populated to the path you specified in
the `variables.auto.tfvars` file.
