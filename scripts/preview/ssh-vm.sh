#!/usr/bin/env bash
#
# Provides SSH access to the the VM where your preview environment is installed.
#

set -euo pipefail

HARVESTER_KUBECONFIG_PATH="$HOME/.kube/config-harvester"
PORT_FORWARD_PID=""

if [[ ! -f "$HARVESTER_KUBECONFIG_PATH" ]]; then
    echo "Missing Harvester kubeconfig at $HARVESTER_KUBECONFIG_PATH. Downloading config."
    kubectl -n werft get secret harvester-kubeconfig -o jsonpath='{.data}' \
    | jq -r '.["harvester-kubeconfig.yml"]' \
    | base64 -d \
    > "$HARVESTER_KUBECONFIG_PATH"
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

function prepareSSHKeys {
    kubectl -n werft get secret harvester-vm-ssh-keys -o jsonpath='{.data}' | jq -r '.["id_rsa"]' | base64 -d > "$HOME/.ssh/id_rsa"
    kubectl -n werft get secret harvester-vm-ssh-keys -o jsonpath='{.data}' | jq -r '.["id_rsa.pub"]' | base64 -d > "$HOME/.ssh/id_rsa.pub"

    chmod 600 "$HOME/.ssh/id_rsa"
    chmod 644 "$HOME/.ssh/id_rsa.pub"
}

function startKubectlPortForwardForSSH {
    local vmName namespace
    vmName="$(git symbolic-ref HEAD 2>&1 | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')"
    namespace="preview-${vmName}"

    echo "Verifying VM exists"
    sudo kubectl \
        --kubeconfig="$HARVESTER_KUBECONFIG_PATH" \
        -n "$namespace" \
        get vmi "${vmName}" > /dev/null

    echo "Starting SSH port-forwaring to VM: ${vmName}"
    sudo kubectl \
        --kubeconfig="$HARVESTER_KUBECONFIG_PATH" \
        -n "$namespace" \
        port-forward service/proxy 22:22 > /dev/null &
    PORT_FORWARD_PID="$!"

    set +e
    while true; do
        echo "Trying to validate SSH connection"
        (ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ubuntu@127.0.0.1 exit 0) && break
        echo "Failed. Sleeping 5 seconds"
        sleep 5
    done
    set -e
}

trap "cleanup" EXIT

prepareSSHKeys
startKubectlPortForwardForSSH
ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ubuntu@127.0.0.1
