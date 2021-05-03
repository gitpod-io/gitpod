---
url: /docs/self-hosted/latest/install/install-on-gcp/
---

# Getting started with Gitpod on GCP

Gitpod runs best on Google Cloud Platform. That's also where [gitpod.io](https://gitpod.io) is deployed and operated at scale.
This guide explains how to install an instance of Gitpod with the following steps:

## 1. Get a GCP project
You need a fresh [Google Cloud project](https://cloud.google.com/resource-manager/docs/creating-managing-projects), for which you can also use the [Google Cloud Platform trial](https://console.cloud.google.com/freetrial) with $300 worth of resources.

Once you have the project, keep its project ID handy.

## 2. Run Terraform
Running the following Terraform script will create a Gitpod Cluster, Database, Service Accounts and everything else necessary to run Gitpod installation .

 > Note: While this is the most integrated and powerful setup, it will burn some money (users reported ~100$/week) even if not used. This obviously depends on the specific configuration, especially node sizing.

  1. Enable APIs:

     1. Visit https://console.cloud.google.com/apis/library/dns.googleapis.com?project=|your-project-id| and hit "Enable".

     2. Visit https://console.cloud.google.com/apis/api/compute.googleapis.com/overview?project=|your-project-id| and hit "Enable".

  2. Install all necessary infrastructure using the following commands:

    ```
    export PROJECT_ID=|your-project-id|
    cd install/gcp-terraform/environment/full
    terraform init
    terraform plan -var "project=$PROJECT_ID" -var 'region=europe-west1' -var 'hostname=gpl.gitpod-self-hosted.com' -var 'certificate_email=test@test.sh'
    terraform apply -var "project=$PROJECT_ID" -var 'region=europe-west1' -var 'hostname=gpl.gitpod-self-hosted.com' -var 'certificate_email=test@test.sh'
    ```
    At the end there are two files:
     - a `values.terraform.yaml` containing all infrastructure-specific helm config
     - a `secrets/kubeconfig` containing the `kubectl` config to connect to the cluster
    
  
## 3. Setup DNS nameserver

  The Terraform scripts create a "dangling" DNS zone with Google's [Cloud DNS](https://cloud.google.com/dns). To finish the setup you have two options:
  - Buy a domain from Google Cloud Domain: https://console.cloud.google.com/net-services/dns/zones?project=|your-project-id|
  - Install Gitpod on a subdomain (`gitpod.my-domain.com`) of an existing domain (`my-domain.com`) that might be from another registrar: For this to work you need to add several `NS` records to the DNS zone `my-domain.com` that point to Google's nameservers.
    1. Go to https://console.cloud.google.com/net-services/dns/zones?project=|your-project-id|, open your Gitpod DNS zone to learn and look for the `NS` entry. This contains a list of nameservers.
    2. Go to the registrar of `my-domain.com` and add a `NS` entry for `gitpod.my-domain.com` that points to _all_ of the Google nameservers (typically 4).

## 4. Install Gitpod using Helm
To actually install Gitpod follow the [the generic Kubernetes instructions](../install-on-kubernetes/) to install Gitpod.
 > Note: You can skip "Configure Ingress to your Gitpod installation" entirely, as this has already been taken care of.

Make sure to always:
 - prepend `values.terraform.yaml` like this: `helm upgrade --install -f values.terraform.yaml -f values.custom.yaml`
 - append your `kubeconfig` file to your `KUBECONFIG` environment variable so `kubectl` is able to access the Gitpod cluster: `export KUBECONFIG=$KUBECONFIG:$PWD/secrets/kubeconfig`

