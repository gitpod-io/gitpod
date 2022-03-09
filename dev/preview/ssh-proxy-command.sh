#!/usr/bin/env bash

source ./dev/preview/util/preview-name-from-branch.sh

VM_NAME="$(preview-name-from-branch)"
NAMESPACE="preview-${VM_NAME}"

while getopts n:p: flag
do
    case "${flag}" in
        n) NAMESPACE="${OPTARG}";;
        p) PORT="${OPTARG}";;
        *) ;;
    esac
done

pkill -f "kubectl --context=harvester (.*)${PORT}:2200"
kubectl \
    --context=harvester \
    --kubeconfig=/home/gitpod/.kube/config \
    -n "${NAMESPACE}" port-forward service/proxy "${PORT}:2200" > /dev/null 2>&1 &

# Wait for the port to be read
while true; do
    sleep 1
    if [[ "$(netcat -z localhost 8022)" -eq 0 ]]; then
        break
    fi
done

# Use netcat as SSH expects ProxyCommand to read and write using stdin/stdout
netcat -X connect localhost "${PORT}"
