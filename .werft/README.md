# Overview

We use werft for our CICD pipeline. We are transforming our scripts to support various types of deployment. Here are few things you should be aware of if you decide to make changes in this directory:

## Prefer Annotations over branch name based logic

Using branch name to pass runtime information to werft script has several drawbacks:
1. Branch name length has limit
1. We endup writing complex logic around branch name parsing
  1. It leads to bad developer experience; someone looking at the code has to rely on comments to understand cryptic parsing logic
  1. It adds additional burden of learning about branch naming format

That said, we still use branch name in special cases like releasing from a particular branch etc.

Due to listed reasons we use werft annotations to pass runtime information. You can read more about annotations [here](https://github.com/csweichel/werft).

## Deployments

Currently all non-main branches are deployed in a preview cluster under a specific namespace. If you make changes to the source branch, the namespace is wiped and the new changes are redeployed.

## Deployment target

We have added a new annotation `deploytarget` to support deployment of gitpod based on the desired target. This annotation based logic is still being developed and only supports `gke` value atm.
We will eventually deprecate the `no-preview` annotation in favour of this annotation. This readme will be updated accordingly.

Future supported values for `deploytarget`:
1. `gke`: Installs gitpod in a fresh gke cluster
1. `namespace`: Installs gitpod in a common kubernetes preview cluster but in a specific namespace
