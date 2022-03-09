#!/usr/bin/env bash

set -euo pipefail

source ./dev/preview/util/preview-name-from-branch.sh

VM_NAME="$(preview-name-from-branch)"

PRIVATE_KEY=$HOME/.ssh/vm_id_rsa
PUBLIC_KEY=$HOME/.ssh/vm_id_rsa.pub
THIS_DIR="$(dirname "$0")"
USER="ubuntu"

KUBECONFIG_PATH="/home/gitpod/.kube/config"
K3S_KUBECONFIG_PATH="$(mktemp)"
MERGED_KUBECONFIG_PATH="$(mktemp)"

K3S_CONTEXT="k3s-preview-environment"
K3S_ENDPOINT="${VM_NAME}.kube.gitpod-dev.com"

while getopts n:p:u: flag
do
    case "${flag}" in
        u) USER="${OPTARG}";;
        *) ;;
    esac
done


function log {
    echo "[$(date)] $*"
}

function set-up-ssh {
    if [[ (! -f $PRIVATE_KEY) || (! -f $PUBLIC_KEY) ]]; then
        log Setting up ssh-keys
        "$THIS_DIR"/install-vm-ssh-keys.sh
    fi
}

set-up-ssh

"$THIS_DIR"/ssh-vm.sh \
    -c "sudo cat /etc/rancher/k3s/k3s.yaml" \
    | sed 's/default/'${K3S_CONTEXT}'/g' \
    | sed -e 's/127.0.0.1/'"${K3S_ENDPOINT}"'/g' \
    > "${K3S_KUBECONFIG_PATH}"

log "Merging kubeconfig files ${KUBECONFIG_PATH} ${K3S_KUBECONFIG_PATH} into ${MERGED_KUBECONFIG_PATH}"
KUBECONFIG="${KUBECONFIG_PATH}:${K3S_KUBECONFIG_PATH}" \
    kubectl config view --flatten --merge > "${MERGED_KUBECONFIG_PATH}"

log "Overwriting ${KUBECONFIG_PATH}"
mv "${MERGED_KUBECONFIG_PATH}" "${KUBECONFIG_PATH}"

log "Cleaning up temporay K3S kubeconfig"
rm "${K3S_KUBECONFIG_PATH}"

log "Done"
