#
# Terraform Module: gitpod
#

hostname: ${hostname}
components:
  proxy:
    loadBalancerIP: ${loadBalancerIP}

installPodSecurityPolicies: true
