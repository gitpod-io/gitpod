#!/usr/bin/env bash
#
# Provides SSH access to the the VM where your preview environment is installed.
#

set -euo pipefail

function log {
    echo "[$(date)] $*"
}

function has-harvester-access {
    kubectl --context=harvester auth can-i get secrets > /dev/null 2>&1 || false
}

if ! has-harvester-access; then
    log "You are missing the harvester context in your kubeconfig. Exiting."
    exit 0
fi

vmName="$(git symbolic-ref HEAD 2>&1 | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')"
namespace="preview-${vmName}"

ssh ubuntu@127.0.0.1 \
    -o UserKnownHostsFile=/dev/null \
    -o StrictHostKeyChecking=no \
    -o "ProxyCommand=/workspace/gitpod/dev/preview/ssh-proxy-command.sh %p ${namespace}" \
    -i "$HOME/.ssh/vm_id_rsa" \
    -p 8022
