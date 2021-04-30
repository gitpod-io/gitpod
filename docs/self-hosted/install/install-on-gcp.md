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

  1. Visit https://console.cloud.google.com/apis/library/dns.googleapis.com?project=|your-project-id| and hit "Enable".

  2. Install all necessary infrastructure using the following commands:

    ```
    export PROJECT_ID=|your-project-id|
    cd install/gcp-terraform/environment/full
    terraform init
    terraform plan -var "project=$PROJECT_ID" -var "region=europe-west1" -var "zone_name=gitpod.test" -var "certificate_email=test@test.sh"
    terraform apply -var "project=$PROJECT_ID" -var "region=europe-west1" -var "zone_name=gitpod.test" -var "certificate_email=test@test.sh"
    ```

## 3. Launch the first workspace
Once finished, the installer will print the URL at which your Gitpod installation can be found. There you need to connect Gitpod to at least one Git provider:
  - [Configure an OAuth application for GitLab](/docs/gitlab-integration/#oauth-application)
  - [Configure an OAuth application for GitHub](/docs/github-integration/#oauth-application)

## 4. Configure the Browser extension
Afterwards you can jump right into your first workspace, by prefixing the repository URL with your Gitpod Self-Hosted URL.

Examples:
 - GitLab: `<your-installation-url>/#https://gitlab.com/gitpod/spring-petclinic`
 - GitHub: `<your-installation-url>/#https://github.com/gitpod-io/spring-petclinic`

# Going further
- Using a [custom domain](../domain/)
- Configuring a [custom Docker registry](../docker-registry/)
- Configuring a [storage backend](../storage/)
- Configuring [workspace sizes](../workspaces/)
