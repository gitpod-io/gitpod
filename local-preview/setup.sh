#!/usr/bin/env bash
SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../dev/preview/workflow/lib/common.sh")"
# shellcheck source=../lib/k8s-util.sh
source "$(realpath "${SCRIPT_PATH}/../dev/preview/workflow/lib/k8s-util.sh")"
PREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBECONFIG_PATH:-$HOME/.kube/config}"
PREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT:-k3d-gitpod}"
PREVIEW_SORUCE_CERT_NAME="certificate-local"

GITPOD_PROXY_SECRET_NAME="proxy-config-certificates";
PREVIEW_GCP_PROJECT="gitpod-dev-preview"
DESTINATION_CERT_NAME="$GITPOD_PROXY_SECRET_NAME"
PREVIEW_NAMESPACE=default
DOMAIN="local.preview.gitpod-dev.com"

secret=$(gcloud secrets versions access latest --secret="${PREVIEW_SORUCE_CERT_NAME}" --project=${PREVIEW_GCP_PROJECT})
kubectl \
create secret generic "${DESTINATION_CERT_NAME}" --namespace="${PREVIEW_NAMESPACE}" --dry-run=client -oyaml \
| yq4 eval-all ".data = $secret | .type = \"kubernetes.io/tls\"" \
| kubectl \
    apply -f -

secret=$(gcloud secrets versions access latest --secret="preview-envs-authproviders" --project=${PREVIEW_GCP_PROJECT})
for row in $(gcloud secrets versions access latest --secret="preview-envs-authproviders" --project=${PREVIEW_GCP_PROJECT}  | yq r - "authProviders" \
| base64 -d -w 0 \
| yq r - authProviders -j \
| jq -r 'to_entries | .[] | @base64'); do
    providerId=$(echo "$row" | base64 -d | jq -r '.value.id | ascii_downcase')
    data=$(echo "$row" | base64 -d | yq r - value --prettyPrint)

    data="${data//preview.gitpod-dev.com/${DOMAIN}}"

    kubectl create secret generic "$providerId" \
        --namespace "${PREVIEW_NAMESPACE}" \
        --from-literal=provider="$data" \
        --dry-run=client -o yaml | \
        kubectl replace --force -f -
done

secret=$(gcloud secrets versions access latest --secret="spicedb-secret" --project=${PREVIEW_GCP_PROJECT})
kubectl \
  create secret generic "spicedb-secret" --namespace="${PREVIEW_NAMESPACE}" --dry-run=client -oyaml \
  | yq4 eval-all ".data = $secret" \
  | kubectl \
    apply -n ${PREVIEW_NAMESPACE} -f -

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.5/cert-manager.yaml
waitUntilAllPodsAreReady "${PREVIEW_K3S_KUBE_PATH}" "${PREVIEW_K3S_KUBE_CONTEXT}" "cert-manager"

kubectl apply -f trust-manager.yaml --server-side --force-conflicts
kubectl apply -f coredns-custom.yaml --server-side --force-conflicts
