#!/usr/bin/env bash
#
# Provides SSH access to the VM where your preview environment is installed.
#

set -euo pipefail

PRIVATE_KEY=$HOME/.ssh/vm_ed25519
PUBLIC_KEY=$HOME/.ssh/vm_ed25519.pub
PORT=2222
USER="ubuntu"
COMMAND=""
BRANCH=""

while getopts c:p:u:b:v: flag
do
    case "${flag}" in
        c) COMMAND="${OPTARG}";;
        p) PORT="${OPTARG}";;
        u) USER="${OPTARG}";;
        v) VM_NAME="${OPTARG}";;
        b) BRANCH="${OPTARG}";;
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

function set-up-ssh {
    if [[ (! -f $PRIVATE_KEY) || (! -f $PUBLIC_KEY) ]]; then
        echo Generate ssh-keys
        ssh-keygen -t ed25519 -q -N "" -f "$PRIVATE_KEY"
    fi
}

set-up-ssh
zone=$(gcloud compute instances list --project gitpod-dev-preview --format="value(zone)" preview-"$VM_NAME")
gcloud compute ssh "$USER@preview-$VM_NAME" \
    --project gitpod-dev-preview \
    --ssh-key-file "$PRIVATE_KEY" \
    --ssh-flag="-p $PORT" \
    --zone="$zone" \
    -- "$COMMAND"
