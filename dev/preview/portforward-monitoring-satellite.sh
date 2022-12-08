#!/usr/bin/env bash
#
# Exposes Prometheus and Grafana's UI
#

if [[ -z "${VM_NAME:-}" ]]; then
    VM_NAME="$(previewctl get name)"
fi

echo "
Starting port-forwarding:

Prometheus:
$(gp url 9090)

Grafana:
$(gp url 3000)

"

# This is just a bit of extra safety to ensure that no other port-forwards are running
# e.g. maybe you forgot you had it running in another terminal etc.
pkill -f "kubectl port-forward (.*)3000:3000"
pkill -f "kubectl port-forward (.*)9090:9090"

# We're using xargs here to run the commands in parallel. This has two benefits as xargs
#
#   1. Will show the stdout/stderr of both processes, making it easier to diagnose issues
#   2. Deals with process termination. If you ^C this script xargs will kill the underlying
#.     processes.
#
echo "svc/grafana 3000:3000 svc/prometheus-k8s 9090:9090" | xargs  -n 2 -P 2 kubectl port-forward --context="$VM_NAME" -n "monitoring-satellite"
