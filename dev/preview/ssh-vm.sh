#!/usr/bin/env bash
#
# Provides SSH access to the the VM where your preview environment is installed.
#

set -euo pipefail

PORT_FORWARD_PID=""

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

function cleanup {
    echo "Executing cleanup"
    if [[ -n "$PORT_FORWARD_PID" ]]; then
        echo "Terminating port-forwarding with PID: $PORT_FORWARD_PID"
        # TODO: Perform more direct cleanup
        # sudo kill -9 "$PORT_FORWARD_PID" > /dev/null 2>&1
        sudo killall kubectl > /dev/null
    fi
}

function startKubectlPortForwardForSSH {
    local vmName namespace
    vmName="$(git symbolic-ref HEAD 2>&1 | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')"
    namespace="preview-${vmName}"

    echo "Verifying VM exists"
    sudo kubectl \
        --kubeconfig="$HOME/.kube/config" \
        --context=harvester \
        -n "$namespace" \
        get vmi "${vmName}" > /dev/null

    echo "Starting SSH port-forwaring to VM: ${vmName}"
    sudo kubectl \
        --kubeconfig="$HOME/.kube/config" \
        --context=harvester \
        -n "$namespace" \
        port-forward service/proxy 22:22 > /dev/null &
    PORT_FORWARD_PID="$!"

    set +e
    while true; do
        echo "Trying to validate SSH connection"
        (ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -i $HOME/.ssh/vm_id_rsa ubuntu@127.0.0.1 exit 0) && break
        echo "Failed. Sleeping 5 seconds"
        sleep 5
    done
    set -e
}

trap "cleanup" EXIT

startKubectlPortForwardForSSH
ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -i $HOME/.ssh/vm_id_rsa ubuntu@127.0.0.1
