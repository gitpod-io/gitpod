#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(dirname "$0")"

source "$THIS_DIR/util/preview-name-from-branch.sh"

PRIVATE_KEY=$HOME/.ssh/vm_id_rsa
PUBLIC_KEY=$HOME/.ssh/vm_id_rsa.pub
USER="ubuntu"
BRANCH=""

KUBECONFIG_PATH="/home/gitpod/.kube/config"
K3S_KUBECONFIG_PATH="$(mktemp)"
MERGED_KUBECONFIG_PATH="$(mktemp)"

while getopts n:p:u:b: flag
do
    case "${flag}" in
        u) USER="${OPTARG}";;
        b) BRANCH="${2}";;
        *) ;;
    esac
done

if [[ "${BRANCH}" == "" ]]; then
    VM_NAME="$(preview-name-from-branch)"
else
    VM_NAME="$(preview-name-from-branch "$BRANCH")"
fi

echo "Installing context from VM: $VM_NAME"

K3S_CONTEXT="${VM_NAME}"
K3S_ENDPOINT="${VM_NAME}.kube.gitpod-dev.com"

function log {
    echo "[$(date)] $*"
}

function set-up-ssh {
    if [[ (! -f $PRIVATE_KEY) || (! -f $PUBLIC_KEY) ]]; then
        log Setting up ssh-keys
        "$THIS_DIR"/util/install-vm-ssh-keys.sh
    fi
}

set-up-ssh

"$THIS_DIR"/ssh-vm.sh \
    -c "sudo cat /etc/rancher/k3s/k3s.yaml" \
    | sed "s/default/${K3S_CONTEXT}/g" \
    | sed -e 's/127.0.0.1/'"${K3S_ENDPOINT}"'/g' \
    > "${K3S_KUBECONFIG_PATH}"

log "Merging kubeconfig files ${KUBECONFIG_PATH} ${K3S_KUBECONFIG_PATH} into ${MERGED_KUBECONFIG_PATH}"
KUBECONFIG="${K3S_KUBECONFIG_PATH}:${KUBECONFIG_PATH}" \
    kubectl config view --flatten --merge > "${MERGED_KUBECONFIG_PATH}"

log "Overwriting ${KUBECONFIG_PATH}"
mv "${MERGED_KUBECONFIG_PATH}" "${KUBECONFIG_PATH}"

log "Cleaning up temporary K3S kubeconfig"
rm "${K3S_KUBECONFIG_PATH}"

log "Done"
