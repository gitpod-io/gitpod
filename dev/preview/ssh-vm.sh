#!/usr/bin/env bash
#
# Provides SSH access to the the VM where your preview environment is installed.
#

set -euo pipefail

VM_NAME="$(git symbolic-ref HEAD 2>&1 | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')"
NAMESPACE="preview-${VM_NAME}"

PRIVATE_KEY=$HOME/.ssh/vm_id_rsa
PUBLIC_KEY=$HOME/.ssh/vm_id_rsa.pub
PORT=8022
THIS_DIR="$(dirname "$0")"
USER="ubuntu"
COMMAND=""

while getopts c:n:p:u: flag
do
    case "${flag}" in
        c) COMMAND="${OPTARG}";;
        n) NAMESPACE="${OPTARG}";;
        p) PORT="${OPTARG}";;
        u) USER="${OPTARG}";;
        *) ;;
    esac
done


function log {
    echo "[$(date)] $*"
}

function has-harvester-access {
    kubectl --context=harvester auth can-i get secrets > /dev/null 2>&1 || false
}

function set-up-ssh {
    if [[ (! -f $PRIVATE_KEY) || (! -f $PUBLIC_KEY) ]]; then
        echo Setting up ssh-keys
        "$THIS_DIR"/install-vm-ssh-keys.sh
    fi
}

if ! has-harvester-access; then
    echo Setting up kubeconfig
    "$THIS_DIR"/download-and-merge-harvester-kubeconfig.sh
fi

set-up-ssh

ssh "$USER"@127.0.0.1 \
    -o UserKnownHostsFile=/dev/null \
    -o StrictHostKeyChecking=no \
    -o "ProxyCommand=$THIS_DIR/ssh-proxy-command.sh -p $PORT -n $NAMESPACE" \
    -i "$HOME/.ssh/vm_id_rsa" \
    -p "$PORT" \
    "$COMMAND"
