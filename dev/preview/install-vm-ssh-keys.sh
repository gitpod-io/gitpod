#!/usr/bin/env bash

set -euo pipefail

PRIVATE_KEY_PATH="$HOME/.ssh/vm_id_rsa"
PUBLIC_KEY_PATH="$HOME/.ssh/vm_id_rsa.pub"

function log {
    echo "[$(date)] $*"
}

function has-dev-access {
    kubectl --context=dev auth can-i get secrets > /dev/null 2>&1 || false
}

if ! has-dev-access; then
    log "The workspace isn't configured to have core-dev access. Exiting."
    exit 0
fi

log "Downloading private key to ${PRIVATE_KEY_PATH}"
kubectl --context dev -n werft get secret harvester-vm-ssh-keys -o jsonpath='{.data}' \
| jq -r '.["id_rsa"]' \
| base64 -d > "${PRIVATE_KEY_PATH}"

log "Downloading public key to ${PUBLIC_KEY_PATH}"
kubectl --context dev -n werft get secret harvester-vm-ssh-keys -o jsonpath='{.data}' \
| jq -r '.["id_rsa.pub"]' \
| base64 -d > "${PUBLIC_KEY_PATH}"

log "Setting permission"
chmod 600 "${PRIVATE_KEY_PATH}"
chmod 644 "${PUBLIC_KEY_PATH}"
