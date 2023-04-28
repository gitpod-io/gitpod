#!/bin/bash

set -eo pipefail

logger -t install-trustmanager "Starting to install trust manager"

# shellcheck disable=SC2016
timeout 5m bash -c '
while [[ -z $(kubectl get certificate trust-manager -n cert-manager --ignore-not-found=true) ]]
do
    logger -t install-trustmanager "Sleeping..."
    sleep 5
    kubectl apply -f /var/lib/gitpod/manifests/trust-manager.yaml --wait=false || true
    logger -t install-trustmanager "Trust manager applied"
done
'

kubectl wait --for=condition=Available --timeout=300s deployment -n cert-manager trust-manager

logger -t install-trustmanager "Finishing installing trust manager"
