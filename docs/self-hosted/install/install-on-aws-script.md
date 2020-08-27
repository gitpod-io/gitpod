---
url: /docs/self-hosted/0.5.0/install/install-on-aws-script/
---

# Getting started with Gitpod on AWS

This guide explains how to install an instance of Gitpod with 3 simple steps:

## 1. Get your AWS credentials
 
You need an [AWS account](https://aws.amazon.com/). Once you have access to an account, follow [these steps](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html) to obtain valid credentials.

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

### Note:
  - Setting up an AWS account the first time can take some time as they require - and test for - a valid credit card.


## 2. Run the installer image
```bash
docker run --rm -it \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -v "$PWD/awsinstall":"/workspace" \
    eu.gcr.io/gitpod-io/self-hosted/installer:latest aws
```

This will kickstart the installation process, authenticate with AWS and automatically set up your Gitpod deployment using Docker and Terraform.

### Note:
  - This guide assumes you have the [docker](https://docs.docker.com/engine/install/) installed.

  - The final step - creating the cluster - might take around 30 minutes on AWS. Good time to grab a cup of coffee!

## 3. Launch the first workspace
Once finished, the installer will print the URL at which your Gitpod installation can be found. There you need to connect Gitpod to at least one Git provider:
  - [Configure an OAuth application for GitLab](/docs/gitlab-integration/#oauth-application)
  - [Configure an OAuth application for GitHub](/docs/github-integration/#oauth-application)

## 4. Configure the Browser extension

Afterwards you can jump right into your first workspace, by prefixing the repository URL with your Gitpod Self-Hosted URL.

Examples:
 - GitLab: `<your-installation-url>/#https://gitlab.com/gitpod/spring-petclinic`
 - GitHub: `<your-installation-url>/#https://github.com/gitpod-io/spring-petclinic`

### Note:
  - The local mount point `./awsinstall` will hold your Terraform config files. You can always modify them and re-run the install script in order to make changes to your Gitpod deployment.

  - The first workspace start might take a up to 10 minutes because it needs to pull several docker images and initialize the registry.

## FAQ

### Q: I get "OptInRequired: You are not subscribed to this service. Please go to http://aws.amazon.com to subscribe."
  A: Your account seems to be missing a credit card. Go to https://portal.aws.amazon.com/billing/signup?type=resubscribe#/resubscribed and finish the subscription process.

### Q: I get "Status Reason: The requested configuration is currently not supported"
  A: Switch to another [AWS region](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html) often helps. Some machine types/configurations are not available in all regions.

### Q: I get "Error: Service "proxy" is invalid: spec.ports[0].nodePort: Invalid value: 31080: provided port is already allocated" on re-applying the terraform script
  A: This is a kubernetes issue on AWS. Please wait for 2-5 minutes and retry (cmp. Kubernetes issues [32987](https://github.com/kubernetes/kubernetes/issues/32987) and [73140](https://github.com/kubernetes/kubernetes/issues/73140)).

### Q: One of my pods throws errors reading "networkPlugin cni failed to set up pod "< name >" network: add cmd: failed to assign an IP address to container"
  A: Seems like the pod-per-node limit is reached: https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt . Please report this as this as a bug [here](https://github.com/gitpod-io/gitpod/issues).

