#!/usr/bin/env bash
#
# Exposes Prometheus and Grafana's UI
#

VM_NAME="$(git symbolic-ref HEAD 2>&1 | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')"
NAMESPACE="preview-${VM_NAME}"

function log {
    echo "[$(date)] $*"
}

pkill -f "kubectl port-forward (.*)3000:3000"
kubectl port-forward --context=harvester -n "${NAMESPACE}" svc/proxy "3000:3000" > /dev/null 2>&1 &

pkill -f "kubectl port-forward (.*)9090:9090"
kubectl port-forward --context=harvester -n "${NAMESPACE}" svc/proxy "9090:9090" > /dev/null 2>&1 &

log "Please follow the link to access Prometheus' UI: $(gp url 9090)"
log "Please follow the link to access Grafanas' UI: $(gp url 3000)"
echo ""
log "If they are not accessible, make sure to re-run the Werft job with the following annotation: 'with-vm=true'"
