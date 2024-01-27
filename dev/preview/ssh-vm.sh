#!/usr/bin/env bash
#
# Provides SSH access to the the VM where your preview environment is installed.
#

set -euo pipefail

THIS_DIR="$(dirname "$0")"

PRIVATE_KEY=$HOME/.ssh/vm_id_rsa
PUBLIC_KEY=$HOME/.ssh/vm_id_rsa.pub
PORT=8022
USER="ubuntu"
COMMAND=""
BRANCH=""

while getopts c:n:p:u:b: flag
do
    case "${flag}" in
        c) COMMAND="${OPTARG}";;
        n) NAMESPACE="${OPTARG}";;
        p) PORT="${OPTARG}";;
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

NAMESPACE="preview-${VM_NAME}"

function log {
    echo "[$(date)] $*"
}

function has-harvester-access {
    kubectl --context=harvester auth can-i get secrets > /dev/null 2>&1 || false
}

function set-up-ssh {
    if [[ (! -f $PRIVATE_KEY) || (! -f $PUBLIC_KEY) ]]; then
        echo Setting up ssh-keys
        "$THIS_DIR"/util/install-vm-ssh-keys.sh
    fi
}

if ! has-harvester-access; then
    echo Setting up kubeconfig
    "$THIS_DIR"/util/download-and-merge-harvester-kubeconfig.sh
fi

set-up-ssh

ssh "$USER"@127.0.0.1 \
    -o UserKnownHostsFile=/dev/null \
    -o StrictHostKeyChecking=no \
    -o LogLevel=ERROR \
    -o "ProxyCommand=$THIS_DIR/util/ssh-proxy-command.sh -p $PORT -n $NAMESPACE -v $VM_NAME" \
    -i "$HOME/.ssh/vm_id_rsa" \
    -p "$PORT" \
    "$COMMAND"
