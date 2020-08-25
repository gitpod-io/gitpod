hostname: ${domain_name}

certificatesSecret:
    secretName: proxy-config-certificates

components:
  proxy:
    loadBalancerIP: null
      
installPodSecurityPolicies: true