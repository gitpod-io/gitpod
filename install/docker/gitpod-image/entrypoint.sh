#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.


set -eu

mount --make-rshared /


BASEDOMAIN=${BASEDOMAIN:-}                          # Used as Gitpod domain, `gitpod.` prefix will be added.
DOMAIN=${DOMAIN:-}                                  # Used as Gitpod domain as is.
REMOVE_NETWORKPOLICIES=${REMOVE_NETWORKPOLICIES:-}  # Remove Gitpod network policies when set to 'true'.
HELMIMAGE=${HELMIMAGE:-alpine/helm:3.6.2}           # Image that is used for the helm install.


mkdir -p /values


if [ -n "$BASEDOMAIN" ] && [ -z "$DOMAIN" ]; then
    DOMAIN="gitpod.$BASEDOMAIN"
    export DOMAIN
fi

if [ -z "$BASEDOMAIN" ] && [ -n "$DOMAIN" ]; then
    BASEDOMAIN="$DOMAIN"
    export BASEDOMAIN
fi

if [ -z "$DOMAIN" ]; then
    >&2 echo "Error: You need to set the environment variable DOMAIN or BASEDOMAIN."
    exit 1
fi


echo "DOMAIN:                  $DOMAIN"
echo "BASEDOMAIN:              $BASEDOMAIN"
echo "REMOVE_NETWORKPOLICIES:  $REMOVE_NETWORKPOLICIES"


# Fix volume ownerships
[ -d "/var/gitpod/docker-registry" ] && chown 1000 /var/gitpod/docker-registry
[ -d "/var/gitpod/minio" ] && chown 1000 /var/gitpod/minio


# Helper function to add a nameserver at top of resolv.conf
add_nameserver() {
    TMP_FILE=$(mktemp)
    echo "nameserver $1" > "$TMP_FILE"
    cat /etc/resolv.conf >> "$TMP_FILE"
    [ ! -f /etc/resolv.conf_backup ] && cp /etc/resolv.conf /etc/resolv.conf_backup
    cp "$TMP_FILE" /etc/resolv.conf
    rm "$TMP_FILE"
}


# If we run gitpod-k3s in a docker-compose setting, we probably want to access
# other containers (e.g. the a local registry or GitLab instance) from within
# the k3s cluster (e.g. from the workspaces). For this, we need access to
# Docker's internal DNS from within the k3s cluster.
# For this, we
# a) add an IP table rule that redirects DNS traffic to localhost (in the k3s container)
#    to the Docker DNS service and
# b) add the container's IP address to the resolv.conf file.

# Add IP tables rules to access Docker's internal DNS 127.0.0.11 from outside
# based on https://serverfault.com/a/826424

TCP_DNS_ADDR=$(iptables-save | grep DOCKER_OUTPUT | grep tcp | grep -o '127\.0\.0\.11:.*$' || printf '')
UDP_DNS_ADDR=$(iptables-save | grep DOCKER_OUTPUT | grep udp | grep -o '127\.0\.0\.11:.*$' || printf '')

if [ -n "$TCP_DNS_ADDR" ] && [ -n "$UDP_DNS_ADDR" ]; then
    iptables -t nat -A PREROUTING -p tcp --dport 53 -j DNAT --to "$TCP_DNS_ADDR"
    iptables -t nat -A PREROUTING -p udp --dport 53 -j DNAT --to "$UDP_DNS_ADDR"

    add_nameserver "$(hostname -i | cut -f1 -d' ')"
fi

# add HTTPS certs secret if certs are given in the folder /certs
CERT=
KEY=
if [ -f /certs/fullchain.pem ] && [ -f /certs/privkey.pem ]; then
    CERT=$(base64 --wrap=0 < /certs/fullchain.pem)
    KEY=$(base64 --wrap=0 < /certs/privkey.pem)
fi
if [ -f /certs/tls.crt ] && [ -f /certs/tls.key ]; then
    CERT=$(base64 --wrap=0 < /certs/tls.crt)
    KEY=$(base64 --wrap=0 < /certs/tls.key)
fi
if [ -n "$CERT" ] && [ -n "$KEY" ]; then
    cat << EOF > /var/lib/rancher/k3s/server/manifests/https-certificates.yaml
apiVersion: v1
kind: Secret
metadata:
  name: https-certificates
  labels:
    app: gitpod
data:
  tls.cert: $CERT
  tls.crt: $CERT
  tls.key: $KEY
EOF
fi

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
sed -i "s+\$HELMIMAGE+$HELMIMAGE+g" "$GITPOD_HELM_INSTALLER_FILE"



# In case we want to bypass the proxy when accessing the registry we need to tell k3s how to access the registry as well
prepare_builtin_registry_for_k3s() {
    echo "Preparing builtin registry for k3s ..."

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
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get secrets builtin-registry-certs |  grep builtin-registry-certs | grep Opaque)" ]; do sleep 10; done

    # save registry certs for k3s
    mkdir -p /registry
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.ca\.crt}' | base64 --decode > /registry/ca.crt
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.tls\.key}' | base64 --decode > /registry/tls.key
    kubectl get secrets builtin-registry-certs -o=jsonpath='{.data.tls\.cert}' | base64 --decode > /registry/tls.cert

    # modify resolv.conf so that registry.default.svc.cluster.local can be resolved from the node
    KUBE_DNS_IP=$(kubectl -n kube-system get service kube-dns -o jsonpath='{.spec.clusterIP}')
    add_nameserver "$KUBE_DNS_IP"
}
if [ "$(yq r /values.yaml components.imageBuilder.registry.bypassProxy)" = "true" ]; then
    prepare_builtin_registry_for_k3s &
fi



# gitpod-helm-installer.yaml needs access to Kubernetes by the public host IP.
kubeconfig_replaceip() {
    while [ ! -f /etc/rancher/k3s/k3s.yaml ]; do sleep 1; done
    HOSTIP=$(hostname -i)
    sed "s+127.0.0.1+$HOSTIP+g" /etc/rancher/k3s/k3s.yaml > /etc/rancher/k3s/k3s_.yaml
}
kubeconfig_replaceip &

installation_completed_hook() {
    # shellcheck disable=SC2143
    while [ -z "$(kubectl get pods | grep gitpod-helm-installer | grep Completed)" ]; do sleep 10; done

    echo "Removing installer manifest ..."
    rm -f "$1"
}
installation_completed_hook "$GITPOD_HELM_INSTALLER_FILE" &


if [ "$REMOVE_NETWORKPOLICIES" = "true" ]; then
    # Remove network policy, temporary fix for: https://github.com/gitpod-com/gitpod/issues/4483
    rm /chart/templates/*networkpolicy*.yaml
fi


# start k3s
/bin/k3s server --disable traefik --node-label "gitpod.io/main-node=true" "$@"
