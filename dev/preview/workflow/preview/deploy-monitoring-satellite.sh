#!/usr/bin/env bash
# shellcheck disable=1091

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")
ROOT="${SCRIPT_PATH}/../../../../"

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../lib/k8s-util.sh
source "$(realpath "${SCRIPT_PATH}/../lib/k8s-util.sh")"

DEV_KUBE_PATH="${DEV_KUBE_PATH:-/home/gitpod/.kube/config}"
DEV_KUBE_CONTEXT="${DEV_KUBE_CONTEXT:-dev}"

PREVIEW_NAME="${PREVIEW_NAME:-$(previewctl get name)}"
PREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBECONFIG_PATH:-/home/gitpod/.kube/config}"
PREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT:-$PREVIEW_NAME}"

INITIAL_DEFAULT_NAMESPACE="$(kubens -c)"

function resetDefaultNamespace {
    echo "Restting default namespace back to $INITIAL_DEFAULT_NAMESPACE"
    kubens "$INITIAL_DEFAULT_NAMESPACE"
}

trap resetDefaultNamespace EXIT

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

tmpdir=$(mktemp -d)
manifests_dir="${tmpdir}/manifests"
mkdir -p "${manifests_dir}"
echo "Using ${tmpdir} with manifests in ${manifests_dir} this can be useful if you have to debug the generated manifests"
cd "${tmpdir}"

if ! command -v envsubst; then
  go install github.com/a8m/envsubst/cmd/envsubst@latest
fi

GOBIN=$(pwd) go install github.com/gitpod-io/observability/installer@main
mv installer observability-installer

HONEYCOMB_API_KEY="$(readWerftSecret honeycomb-api-key apikey)" \
PROM_REMOTE_WRITE_USER="$(readWerftSecret prometheus-remote-write-auth user)" \
PROM_REMOTE_WRITE_PASSWORD="$(readWerftSecret prometheus-remote-write-auth password)" \
PREVIEW_NAME="${PREVIEW_NAME}" \
WORKSPACE_ROOT="${ROOT}" \
envsubst <"${ROOT}/dev/preview/workflow/config/monitoring-satellite.yaml" \
| ./observability-installer render --app monitoring-satellite --output-split-files "${manifests_dir}" --config -

# Not all resources will have the namespace explicitly defined in the manifest but rather expect the
# "default namespace" to be the appropriate one - this is because we deploy the same resources to different
# namespaces in depending on the environment. So we temporarily set the default namespace to monitoring-satellite
echo "Setting default namespace to monitoring-satellite"
kubens monitoring-satellite

# we have to apply the CRDs first and wait until they are available before we can apply the rest
find "${manifests_dir}" -name "*CustomResourceDefinition*" -exec kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" apply -f {} --server-side \;

echo "Waiting for CRDs"
kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    -n monitoring-satellite wait --for condition=established --timeout=60s crd/servicemonitors.monitoring.coreos.com

echo "Applying generated manifests"
for f in "${manifests_dir}"/*.yaml; do
    echo "Applying $f"
    kubectl \
        --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
        --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
        apply --server-side -f "${f}"
done

echo "Patching grafana deployment"
kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    patch deployments.apps -n monitoring-satellite grafana --type=json -p="[{'op': 'remove', 'path': '/spec/template/spec/nodeSelector'}]"
