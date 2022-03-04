#!/usr/bin/env bash

set -euo pipefail

KUBE_CONTEXT="dev"
KUBECONFIG_PATH="/home/gitpod/.kube/config"
HARVESTER_KUBECONFIG_PATH="$(mktemp)"
MERGED_KUBECONFIG_PATH="$(mktemp)"

function log {
    echo "[$(date)] $*"
}

function has-dev-access {
    kubectl --context=$KUBE_CONTEXT auth can-i get secrets > /dev/null 2>&1 || false
}

if ! has-dev-access; then
    log "The workspace isn't configured to have core-dev access. Exiting."
    exit 1
fi

log "Downloading and preparing Harvester kubeconfig"
kubectl --context=$KUBE_CONTEXT -n werft get secret harvester-kubeconfig -o jsonpath='{.data}' \
| jq -r '.["harvester-kubeconfig.yml"]' \
| base64 -d \
| sed 's/default/harvester/g' \
> "${HARVESTER_KUBECONFIG_PATH}"

# Order of files is important, we have the original config first so we preserve
# the value of current-context
log "Merging kubeconfig files ${KUBECONFIG_PATH} ${HARVESTER_KUBECONFIG_PATH} into ${MERGED_KUBECONFIG_PATH}"
KUBECONFIG="${KUBECONFIG_PATH}:${HARVESTER_KUBECONFIG_PATH}" \
    kubectl --context=$KUBE_CONTEXT config view --flatten --merge > "${MERGED_KUBECONFIG_PATH}"

log "Overwriting ${KUBECONFIG_PATH}"
mv "${MERGED_KUBECONFIG_PATH}" "${KUBECONFIG_PATH}"

log "Cleaning up temporay Harveter kubeconfig"
rm "${HARVESTER_KUBECONFIG_PATH}"

log "Done"
