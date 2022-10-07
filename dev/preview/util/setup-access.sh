#!/usr/bin/env bash

set -euo pipefail

function log {
  echo "[$(date)] $*"
}

KUBECONFIG_PATH="$HOME/.kube/config"

if test -f "${KUBECONFIG_PATH}"; then
  log "Backing up kubeconfig to ${KUBECONFIG_PATH}.bak"
  mv "${KUBECONFIG_PATH}" "${KUBECONFIG_PATH}.bak"
fi

# shellcheck disable=SC2139
alias kubectl="KUBECONFIG=${KUBECONFIG_PATH} kubectl"

if [ -n "${GCLOUD_SERVICE_ACCOUNT_PATH-}" ]; then
  auth=$(gcloud config get-value account)
  if [[ "${auth}" = "(unset)" ]] || [ -z "${auth:-}" ]; then
    gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"
  fi
fi

KUBECONFIG="${KUBECONFIG_PATH}" gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev
kubectl config rename-context "$(kubectl config current-context)" dev

HARVESTER_KUBECONFIG_PATH=$(mktemp)
MERGED_KUBECONFIG_PATH=$(mktemp)

kubectl --context=dev -n werft get secret harvester-kubeconfig -o jsonpath='{.data}' |
  jq -r '.["harvester-kubeconfig.yml"]' |
  base64 -d |
  sed 's/default/harvester/g' \
    >"${HARVESTER_KUBECONFIG_PATH}"

KUBECONFIG="${KUBECONFIG_PATH}:${HARVESTER_KUBECONFIG_PATH}" \
  kubectl --context=dev config view --flatten --merge >"${MERGED_KUBECONFIG_PATH}"

log "Overwriting ${KUBECONFIG_PATH}"
mv "${MERGED_KUBECONFIG_PATH}" "${KUBECONFIG_PATH}"

log "Cleaning up temporary Harvester kubeconfig"
rm "${HARVESTER_KUBECONFIG_PATH}"

log "Done"
