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

    cat << EOF > /default_values/02_certificates_secret.yaml
certificatesSecret:
  secretName: proxy-config-certificates
EOF
fi


prepare_builtin_registry_for_k3s() {

    # config builtin registry for k3s
    mkdir -p /etc/rancher/k3s/
    cat << EOF > /etc/rancher/k3s/registries.yaml
mirrors:
  registry.default.svc.cluster.local:
    endpoint:
      - "https://registry.default.svc.cluster.local:443"
configs:
  "registry.default.svc.cluster.local:443":
    tls:
      cert_file: /registry/tls.cert
      key_file:  /registry/tls.key
      ca_file:   /registry/ca.crt
EOF

    echo "Waiting for builtin-registry-certs secrets ..."
    while [ -z "$(kubectl get secrets builtin-registry-certs |  grep builtin-registry-certs | grep Opaque)" ]; do sleep 10; done

    # save registry certs for k3s
    mkdir -p /registry
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.ca\.crt}' | base64 --decode > /registry/ca.crt
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.tls\.key}' | base64 --decode > /registry/tls.key
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.tls\.cert}' | base64 --decode > /registry/tls.cert

    # modify resolv.conf so that registry.default.svc.cluster.local can be resolved from the node
    KUBE_DNS_IP=$(kubectl -n kube-system get service kube-dns -o jsonpath='{.spec.clusterIP}')
    TMP_FILE=$(mktemp)
    sed "s/nameserver.*/nameserver $KUBE_DNS_IP/g" /etc/resolv.conf > "$TMP_FILE"
    cp "$TMP_FILE" /etc/resolv.conf
    rm "$TMP_FILE"
    cat /etc/resolv.conf
}


case "$DOMAIN" in 
  *ip.mygitpod.com)
    cat << EOF > /default_values/03_ip_mygitpod_com.yaml
forceHTTPS: true
ingressMode: pathAndHost
components:
  wsProxy:
    disabled: false
  imageBuilder:
    registry:
      bypassProxy: true
EOF
    prepare_builtin_registry_for_k3s &
    ;;
esac


# prepare Gitpod helm installer
GITPOD_HELM_INSTALLER_FILE=/var/lib/rancher/k3s/server/manifests/gitpod-helm-installer.yaml

touch /values.yaml
if [ -d /default_values ] && [ "$(ls /default_values/*.y*ml)" ]; then
    for values_file in /default_values/*.y*ml; do
        # merge values and update /values.yaml
        yq m -ixa /values.yaml "$values_file"
    done
fi
if [ -d /values ]&& [ "$(ls /values/*.y*ml)" ]; then
    for values_file in /values/*.y*ml; do
        # merge values and update /values.yaml
        yq m -ixa /values.yaml "$values_file"
    done
fi
sed 's/^/    /' /values.yaml >> "$GITPOD_HELM_INSTALLER_FILE"

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
