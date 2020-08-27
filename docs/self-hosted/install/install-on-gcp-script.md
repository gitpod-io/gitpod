---
url: /docs/self-hosted/0.5.0/install/install-on-gcp-script/
---

# Getting started with Gitpod on GCP

Gitpod runs best on Google Cloud Platform. That's also where [gitpod.io](https://gitpod.io) is deployed and operated at scale.
This guide explains how to install an instance of Gitpod with 3 simple steps:

# 1. Get a GCP project

You need a fresh [Google Cloud project](https://cloud.google.com/resource-manager/docs/creating-managing-projects), for which you can also use the [Google Cloud Platform trial](https://console.cloud.google.com/freetrial) with $300 worth of resources.

Once you have the project, keep its project ID handy.

## 2. Run the installer image

```bash
docker run --rm -it \
    -v $PWD/gcloud:/root/.config/gcloud \
    -v $PWD/gpinstall:/workspace \
    eu.gcr.io/gitpod-io/self-hosted/installer:latest \
    gcp
```

This will kickstart the installation process, log in with Google Cloud, and automatically set up your Gitpod deployment using [Terraform](https://www.terraform.io) and [Helm](https://helm.sh).

### Note:
- This guide assumes you have the [docker](https://docs.docker.com/engine/install/) installed.

- The local mount point `$PWD/gpinstall` will hold your Terraform config files. You can always modify them and re-run the install script in order to make changes to your Gitpod deployment.

- The local mount point `$PWD/gcloud` will cache your Google Cloud credentials. It is safe to delete this folder if you don't wish to leave any tokens behind.

Once the installation process is complete, the script will print the URL at which your Gitpod installation can be accessed.

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
