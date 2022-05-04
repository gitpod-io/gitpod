#!/usr/bin/env bash

while getopts n:p:v: flag
do
    case "${flag}" in
        n) NAMESPACE="${OPTARG}";;
        p) PORT="${OPTARG}";;
        v) VM_NAME="${OPTARG}";;
        *) ;;
    esac
done

if [[ -z "${VM_NAME:-}" ]]; then
    echo "VM_NAME not specified"
    exit 1
fi

NAMESPACE="preview-${VM_NAME}"

pkill -f "kubectl --context=harvester (.*)${PORT}:2200"
kubectl \
    --context=harvester \
    --kubeconfig=/home/gitpod/.kube/config \
    -n "${NAMESPACE}" port-forward service/proxy "${PORT}:2200" > /dev/null 2>&1 &

# Wait for the port to be read
while true; do
    sleep 1
    if [[ "$(netcat -z localhost "${PORT}")" -eq 0 ]]; then
        break
    fi
done

# There seems to be a race condition somewhere. If we don't sleep a bit here
# we're seeing sporadic SSH connection failure with the following messages
#
#    kex_exchange_identification: Connection closed by remote host
#
# We have created an issue to debug further and remove this fixed sleep
#
#    https://github.com/gitpod-io/ops/issues/1984
sleep 10s

# Use netcat as SSH expects ProxyCommand to read and write using stdin/stdout
netcat -X connect localhost "${PORT}"
