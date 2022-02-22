# KOTS

[Kubernetes Off-The-Shelf(KOTS)](https://kots.io/) is how we deliver
Gitpod to enterprise customers.

# Getting started

You will need:
 - a Kubernetes cluster
 - a [Replicated](https://vendor.replicated.com) license file

Go to [our Replicated channels page](https://vendor.replicated.com/apps/gitpod/channels) and
follow the installation instructions on screen.

# Terminology

KOTS is the technology which is used to deliver a Replicated installation. Generally,
KOTS should refer to the underlying open source technology and Replicated is the
commercially supported project.

# Development

## Authentication

Two environment variables are required to be able to publish to our Replicated account:

 - `REPLICATED_APP`: the unique application slug
 - `REPLICATED_API_TOKEN`: a [User API Token](https://vendor.replicated.com/account-settings) with `Read/Write` permissions

## Naming conventions

- Starts with `kots` - part of the KOTS configuration. Typically, this will follow the KOTS documentation/conventions
- Starts with `gitpod` - part of the Gitpod application. Typically, this will be something we define/own
- Starts with `helm` - a Helm chart
- Starts with `crd` - a Custom Resource Definition

## Helm charts

KOTS [requires](https://kots.io/reference/v1beta1/helmchart) Helm charts to be uploaded as a `.tgz`
file. The `make helm` command iterates through everything inside `charts`, installs the dependencies
and packages them up as a `.tgz` file.

The `.tgz` files should not be committed to the repository.

## Create an unstable release

An unstable release can be created by running `make create_unstable_release`. This builds and publishes
a new unstable release to the account. This can be then applied to your development cluster.
