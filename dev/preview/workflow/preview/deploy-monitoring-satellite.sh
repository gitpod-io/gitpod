#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")
ROOT="${SCRIPT_PATH}/../../../../"

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../../util/preview-name-from-branch.sh
source "$(realpath "${SCRIPT_PATH}/../../util/preview-name-from-branch.sh")"
# shellcheck source=../lib/k8s-util.sh
source "$(realpath "${SCRIPT_PATH}/../lib/k8s-util.sh")"

DEV_KUBE_PATH="${DEV_KUBE_PATH:-/home/gitpod/.kube/config}"
DEV_KUBE_CONTEXT="${DEV_KUBE_CONTEXT:-dev}"

PREVIEW_NAME="${PREVIEW_NAME:-$(preview-name-from-branch)}"
PREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBECONFIG_PATH:-/home/gitpod/.kube/config}"
PREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT:-$PREVIEW_NAME}"

waitUntilAllPodsAreReady "${PREVIEW_K3S_KUBE_PATH}" "${PREVIEW_K3S_KUBE_CONTEXT}" "kube-system"

kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    create ns monitoring-satellite --dry-run=client -o yaml \
| kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f -

kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    create ns certmanager --dry-run=client -o yaml \
| kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f -

if ! command -v envsubst; then
  go install github.com/a8m/envsubst/cmd/envsubst@latest
fi

GOBIN=$(pwd) go install github.com/gitpod-io/observability/installer@main
mv installer observability-installer

tmpdir=$(mktemp -d)

HONEYCOMB_API_KEY="$(readWerftSecret honeycomb-api-key apikey)" \
PROM_REMOTE_WRITE_USER="$(readWerftSecret prometheus-remote-write-auth user)" \
PROM_REMOTE_WRITE_PASSWORD="$(readWerftSecret prometheus-remote-write-auth password)" \
PREVIEW_NAME="${PREVIEW_NAME}" \
envsubst <"${ROOT}/dev/preview/workflow/config/monitoring-satellite.yaml" \
| ./observability-installer render --app monitoring-satellite --output-split-files "${tmpdir}" --config -

pushd "${tmpdir}"

# we have to apply the CRDs first and wait until they are available before we can apply the rest
find . -name "*CustomResourceDefinition*" -exec kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" apply -f {} --server-side \;

# wait for the CRDs
kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    -n monitoring-satellite wait --for condition=established --timeout=60s crd/servicemonitors.monitoring.coreos.com

kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply --server-side -f .

kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    patch deployments.apps -n monitoring-satellite grafana --type=json -p="[{'op': 'remove', 'path': '/spec/template/spec/nodeSelector'}]"

popd

rm observability-installer
