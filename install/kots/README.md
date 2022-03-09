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

> tl;dr the `make` command will build and push a release to your development channel

## Authentication

The following environment variables are required to be able to publish to our Replicated account:

 - `REPLICATED_APP`: the unique application slug. If in doubt, use `gitpod-pov`.
 - `REPLICATED_API_TOKEN`: a [User API Token](https://vendor.replicated.com/account-settings) with `Read/Write` permissions
 - `REPLICATED_DEV_CHANNEL`: the channel to push dev releases to. Use the naming convention `dev-<initials>` (eg, `dev-sje`).

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

# Create a development release

A development release can be created by running `make create_dev_release`. This builds and publishes
a new development release to the account. This can then be applied to your development cluster.

Development releases should be used by individual developers when testing and developing a KOTS release.

## Create an unstable release

An unstable release can be created by running `make create_unstable_release`. This builds and publishes
a new unstable release to the account. This can then be applied to your development cluster.

Unstable releases should be used as the first part of creating a stable release.

## Promoting a release to beta and stable

Beta and stable are the channels used to deliver a KOTS application to the general public. A beta release
is considered a release candidate. Once testing has passed, it is promoted to the stable channel.

Promotion of releases from unstable to stable should be done in the management console on the
[Replicated vendor homepage](https://vendor.replicated.com/apps/gitpod).
