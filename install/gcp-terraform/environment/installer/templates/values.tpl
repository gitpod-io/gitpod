hostname: ${hostname}
components:
    proxy:
        loadBalancerIP: ${loadbalancer_ip}
        certbot:
            enabled: ${certbot_enabled}
            email: ${certbot_email}
    wsProxy:
        disabled: false
        ingress:
            portRange:
                start: 10000
                end: 11000

installPodSecurityPolicies: true
ingressMode: pathAndHost
forceHTTPS: ${force_https}
authProviders: []
