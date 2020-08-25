#
# Terraform Module: gitpod
#

hostname: ${hostname}
components:
  proxy:
    loadBalancerIP: ${loadBalancerIP}

installPodSecurityPolicies: true

imagePrefix: eu.gcr.io/gitpod-core-dev/build/
version: cw-core-docker-installer.7