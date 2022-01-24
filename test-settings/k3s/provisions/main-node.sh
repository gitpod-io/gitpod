#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


set -euo pipefail
trap 'catch $? "$0"' EXIT

catch() {
  if [ "$1" != "0" ]; then
    echo "$2: Error $1"
  fi
}


echo "install and start k3s"
export INSTALL_K3S_EXEC="server --disable traefik  --flannel-backend=none --disable-network-policy --node-label gitpod.io/workload_meta=true --node-label gitpod.io/workload_ide=true --node-label gitpod.io/workload_workspace_services=true --node-label gitpod.io/workload_workspace_regular=true --node-label gitpod.io/workload_workspace_headless=true"
export K3S_CLUSTER_SECRET=qWo6sn3VWERh3dBBQniPLTqtZzEHURsriJNhTqus
export K3S_NODE_NAME=main
export K3S_KUBECONFIG_MODE="644"
curl -sSfL https://get.k3s.io | sh -

echo "install kubectl bash-completion"
echo 'source <(kubectl completion bash)' >>~/.bashrc

echo "add calico"
printf "waiting for the manifest folder ..."
until sudo test -d /var/lib/rancher/k3s/server/manifests; do printf "."; sleep 1; done; echo ""
# TODO: allow_ip_forwarding, see: https://github.com/k3s-io/klipper-lb/issues/6#issuecomment-709691157
sudo curl -sSLo /var/lib/rancher/k3s/server/manifests/calico.yaml https://raw.githubusercontent.com/corneliusludmann/gitpod-k3s-droplet/main/gitpod-install/calico.yaml
#sudo curl -sSLo /var/lib/rancher/k3s/server/manifests/calico.yaml https://docs.projectcalico.org/manifests/calico-vxlan.yaml

if [[ $(wc -l <certs/https-certificates.yaml) -ge 2 ]]; then
    echo "restore certificates"
    sudo cp certs/*.yaml /var/lib/rancher/k3s/server/manifests/
    printf "waiting for the restored certificate secret ..."
    until kubectl get secret https-certificates >/dev/null 2>/dev/null; do printf "."; sleep 1; done; echo ""
    kubectl get secret https-certificates
fi

echo "add manifests"
sudo cp manifests/*.yaml /var/lib/rancher/k3s/server/manifests/

echo "add Gitpod"
./gitpod-installer validate config --config gitpod.config.yaml

printf "waiting (max. 10 minutes) for all prerequisites ..."
# shellcheck disable=SC2034
for i in {1..120}; do
    if ./gitpod-installer validate cluster --kubeconfig /etc/rancher/k3s/k3s.yaml --config gitpod.config.yaml 2>/dev/null; then
        echo ""
        break
    else
        printf '.'
        sleep 5
    fi
done
./gitpod-installer validate cluster --kubeconfig /etc/rancher/k3s/k3s.yaml --config gitpod.config.yaml

./gitpod-installer render --config gitpod.config.yaml > gitpod.yaml
sudo cp gitpod.yaml /var/lib/rancher/k3s/server/manifests/gitpod.yaml

printf "waiting (max. 20 minutes) for all pods ..."
# shellcheck disable=SC2034
for i in {1..240}; do
    phases=$(kubectl get pods --no-headers -o=custom-columns=STATUS:status.phase)
    if [[ -z "$phases" ]] || echo "$phases" | grep -qv Running; then
        if [[ "$i" == "240" ]]; then
            exit 1
        fi
        printf '.'
        sleep 5
    else
        echo ""
        break
    fi
done
kubectl get pods

echo "Gitpod is up and running."
