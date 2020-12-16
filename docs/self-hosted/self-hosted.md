---
url: /docs/self-hosted/latest/self-hosted/
---


# Gitpod Self-Hosted

Gitpod, just as you know it from [gitpod.io](https://gitpod.io), can be deployed and operated on your own infrastructure. It supports different cloud providers, self-managed Kubernetes clusters, corporate firewalls, and even off-grid / air-gapped networks.


## Installation

You can find all the installation methods and relevant scripts under the [`install`](https://github.com/gitpod-io/gitpod/tree/master/install) directory.

**Recommended installation**: We strongly recommend choosing GCP or AWS to deploy and run a Gitpod instance. You can use our Terraform scripts to configure, deploy, and upgrade an instance.

The state of deploying Gitpod on vanilla Kubernetes is not mature yet but you can try it by using the helm charts from the [`chart`](https://github.com/gitpod-io/gitpod/tree/master/chart) directory.

### Install on Google Cloud Platform

The easiest way to install Gitpod Self-Hosted is currently on Google Cloud Platform (that's also where [gitpod.io](https://gitpod.io) is deployed). GCP is the recommended platform for most users:

* [Install Gitpod on Google Cloud Platform](../install/install-on-gcp-script/)

### Install on AWS

Alternatively, Gitpod comes with a setup for AWS that integrates with some AWS resource, like Load Balancers or S3 for storing workspace data:

* [Install Gitpod on AWS](../install/install-on-aws-script/)

### Install on any Kubernetes cluster

If you already have a Kubernetes cluster, or don't want/cannot use AWS or GCP, please follow the generic guide:

* [Install Gitpod on Kubernetes](../install/install-on-kubernetes/)

Note: Dedicated installation steps for Azure and OpenShift are on our roadmap.
