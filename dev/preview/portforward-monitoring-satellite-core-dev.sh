#!/usr/bin/env bash
#
# Exposes Prometheus and Grafana's UI
#

source ./dev/preview/util/preview-name-from-branch.sh

PREVIEW_NAME="$(preview-name-from-branch)"
NAMESPACE="staging-${PREVIEW_NAME}"

function log {
    echo "[$(date)] $*"
}

pkill -f "kubectl port-forward (.*)3000:3000"
kubectl port-forward --context=dev -n "${NAMESPACE}"  svc/grafana "3000:3000" > /dev/null 2>&1 &

pkill -f "kubectl port-forward (.*)9090:9090"
kubectl port-forward --context=dev -n "${NAMESPACE}" svc/prometheus-k8s "9090:9090" > /dev/null 2>&1 &

log "Please follow the link to access Prometheus' UI: $(gp url 9090)"
log "Please follow the link to access Grafanas' UI: $(gp url 3000)"
echo ""
log "If they are not accessible, make sure to re-run the Werft job with the following annotation: 'with-observability=true'"
