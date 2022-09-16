#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

if [[ -z "${PREVIEW_NAME}" ]]; then
  echo "Must set PREVIEW_NAME variable" 1>&2
  exit 1
fi

if [[ -z "${KUBE_PATH}" ]]; then
  echo "Must set KUBE_PATH variable" 1>&2
  exit 1
fi

# exports all vars
shopt -os allexport

kubectl --kubeconfig "${KUBE_PATH}" create ns monitoring-satellite || true
kubectl --kubeconfig "${KUBE_PATH}" create ns certmanager || true

if ! command -v envsubst; then
  go install github.com/a8m/envsubst/cmd/envsubst@latest
fi

GOBIN=$(pwd) go install github.com/gitpod-io/observability/installer@main
mv installer observability-installer

tmpdir=$(mktemp -d)

envsubst <"${SCRIPT_PATH}/manifests/monitoring-satellite.yaml" | ./observability-installer render --output-split-files "${tmpdir}" --config -

pushd "${tmpdir}"

# we have to apply the CRDs first and wait until they are available before we can apply the rest
find . -name "*CustomResourceDefinition*" -exec kubectl --kubeconfig "${KUBE_PATH}" apply -f {} --server-side \;

# wait for the CRDs
kubectl --kubeconfig "${KUBE_PATH}" -n monitoring-satellite wait --for condition=established --timeout=60s crd/servicemonitors.monitoring.coreos.com

kubectl --kubeconfig "${KUBE_PATH}" apply --server-side -f .

kubectl --kubeconfig "${KUBE_PATH}" patch deployments.apps -n monitoring-satellite grafana --type=json -p="[{'op': 'remove', 'path': '/spec/template/spec/nodeSelector'}]"

popd

rm observability-installer
