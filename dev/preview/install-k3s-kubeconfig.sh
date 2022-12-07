#!/usr/bin/env bash

# shellcheck disable=SC2069

set -euo pipefail


THIS_DIR="$(dirname "$0")"

PRIVATE_KEY=$HOME/.ssh/vm_id_rsa
PUBLIC_KEY=$HOME/.ssh/vm_id_rsa.pub
USER="ubuntu"
BRANCH=""
GCLOUD_SERVICE_ACCOUNT_PATH=${GCLOUD_SERVICE_ACCOUNT_PATH:-}

KUBECONFIG_PATH="/home/gitpod/.kube/config"
K3S_KUBECONFIG_PATH=${K3S_KUBECONFIG_PATH:-$(mktemp)}
MERGED_KUBECONFIG_PATH=${MERGED_KUBECONFIG_PATH:-$(mktemp)}

while getopts n:p:u:b: flag
do
    case "${flag}" in
        u) USER="${OPTARG}";;
        b) BRANCH="${2}";;
        *) ;;
    esac
done

if [ -z "${VM_NAME:-}" ]; then
  if [[ "${BRANCH}" == "" ]]; then
      VM_NAME="$(previewctl get name)"
  else
      VM_NAME="$(previewctl get name --branch "$BRANCH")"
  fi
fi

K3S_CONTEXT="${VM_NAME}"
K3S_ENDPOINT="${VM_NAME}.kube.gitpod-dev.com"

# If we can access the k3s cluster, there's nothing to do
if kubectl --context="${K3S_CONTEXT}" auth can-i get secrets 2>&1 1>/dev/null ;then
  exit 0
fi

echo "Installing context from VM: $VM_NAME"

# Run this part only in automation and if we don't have access to dev/harvester
if [ -n "${WERFT_SERVICE_HOST-}" ];then
  for ctx in dev harvester;do
    if ! kubectl --context="${ctx}" auth can-i get secrets 2>&1 1>/dev/null; then
      "$THIS_DIR"/util/setup-access.sh
    fi
  done
fi

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

log "Done"
