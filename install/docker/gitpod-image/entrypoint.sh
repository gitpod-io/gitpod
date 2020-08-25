#!/bin/sh
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.


set -eu

mount --make-shared /sys/fs/cgroup
mount --make-shared /var/gitpod/workspaces
mount --make-shared /proc


BASEDOMAIN=${BASEDOMAIN:-}
DOMAIN=${DOMAIN:-}
DNSSERVER=${DNSSERVER:-}


mkdir -p /values


if [ ! -z "$BASEDOMAIN" ] && [ -z "$DOMAIN" ]; then
    DOMAIN="gitpod.$BASEDOMAIN"
    export DOMAIN
fi

if [ -z "$BASEDOMAIN" ] && [ ! -z "$DOMAIN" ]; then
    BASEDOMAIN="$DOMAIN"
    export BASEDOMAIN
fi

if [ -z "$DOMAIN" ]; then
    >&2 echo "Error: You need to set the environment variable DOMAIN or BASEDOMAIN."
    exit 1
fi


GITPOD_CHART_VERSION=${GITPOD_CHART_VERSION:-0.5.0}


echo "DOMAIN:               $DOMAIN"
echo "BASEDOMAIN:           $BASEDOMAIN"
echo "DNSSERVER:            $DNSSERVER"
echo "GITPOD_CHART_VERSION: $GITPOD_CHART_VERSION"


# add HTTPS certs secret if certs a given
if [ -f /certs/chain.pem ] && [ -f /certs/dhparams.pem ] && [ -f /certs/fullchain.pem ] && [ -f /certs/privkey.pem ]; then
    CHAIN=$(base64 --wrap=0 < /certs/chain.pem)
    DHPARAMS=$(base64 --wrap=0 < /certs/dhparams.pem)
    FULLCHAIN=$(base64 --wrap=0 < /certs/fullchain.pem)
    PRIVKEY=$(base64 --wrap=0 < /certs/privkey.pem)
    cat << EOF > /var/lib/rancher/k3s/server/manifests/proxy-config-certificates.yaml
apiVersion: v1
kind: Secret
metadata:
  name: proxy-config-certificates
  labels:
    app: gitpod
data:
  chain.pem: $CHAIN
  dhparams.pem: $DHPARAMS
  fullchain.pem: $FULLCHAIN
  privkey.pem: $PRIVKEY
EOF

    cat << EOF > /values/_certificates_secret.yaml
certificatesSecret:
  secretName: proxy-config-certificates
EOF
fi


case "$DOMAIN" in 
  *ip.mygitpod.com)
    cat << EOF > /values/_ip_mygitpod_com.yaml
forceHTTPS: true
ingressMode: pathAndHost
components:
  wsProxy:
    disabled: false
EOF
    ;;
esac


# prepare Gitpod helm installer
GITPOD_HELM_INSTALLER_FILE=/var/lib/rancher/k3s/server/manifests/gitpod-helm-installer.yaml

if [ -f /values.yaml ]; then
    # merge values and update default_values.yaml
    yq m -ixa /default_values.yaml /values.yaml
fi
if [ -d /values ]; then
    for values_file in /values/*.y*ml; do
        # merge values and update default_values.yaml
        yq m -ixa /default_values.yaml "$values_file"
    done
fi
sed 's/^/    /' /default_values.yaml >> "$GITPOD_HELM_INSTALLER_FILE"

sed -i "s/\$DOMAIN/$DOMAIN/g" "$GITPOD_HELM_INSTALLER_FILE"
sed -i "s/\$BASEDOMAIN/$BASEDOMAIN/g" "$GITPOD_HELM_INSTALLER_FILE"
sed -i "s/\$GITPOD_CHART_VERSION/$GITPOD_CHART_VERSION/g" "$GITPOD_HELM_INSTALLER_FILE"

# gitpod-helm-installer.yaml needs access to kubernetes by the public host IP.
kubeconfig_replaceip() {
    while [ ! -f /etc/rancher/k3s/k3s.yaml ]; do sleep 1; done
    HOSTIP=$(hostname -i)
    sed "s+127.0.0.1+$HOSTIP+g" /etc/rancher/k3s/k3s.yaml > /etc/rancher/k3s/k3s_.yaml
}
kubeconfig_replaceip &

installation_completed_hook() {
    while [ -z "$(kubectl get pods | grep gitpod-helm-installer | grep Completed)" ]; do sleep 10; done

    echo "Removing installer manifest ..."
    rm -f /var/lib/rancher/k3s/server/manifests/gitpod-helm-installer.yaml
}
installation_completed_hook &



# patch DNS config if DNSSERVER environment variable is given
if [ -n "$BASEDOMAIN" ] && [ -n "$DNSSERVER" ]; then
    patchdns() {
        echo "Waiting for CoreDNS to patch config ..."
        while [ -z "$(kubectl get pods -n kube-system | grep coredns | grep Running)" ]; do sleep 10; done

        BASEDOMAIN=$1
        DNSSERVER=$2

        if [ -z "$(kubectl get configmap -n kube-system coredns -o json | grep $BASEDOMAIN)" ]; then
            echo "Patching CoreDNS config ..."

            kubectl get configmap -n kube-system coredns -o json | \
                sed -e "s+.:53+$BASEDOMAIN {\\\\n  forward . $DNSSERVER\\\\n}\\\\n.:53+g" | \
                kubectl apply -f -
            echo "CoreDNS config patched."
        else
            echo "CoreDNS has been patched already."
        fi
    }
    patchdns "$BASEDOMAIN" "$DNSSERVER" &
fi


# start k3s
/bin/k3s server --disable traefik
