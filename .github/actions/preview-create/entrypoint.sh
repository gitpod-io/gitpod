#!/usr/bin/env bash
# shellcheck disable=SC2155

set -euo pipefail
set -x

mkdir -p "$HOME/.kube"
export KUBECONFIG="$HOME/.kube/config"

CREDENTIALS_FILE=$(mktemp)
echo "${INPUT_SA_KEY}" >> "${CREDENTIALS_FILE}"
export PREVIEW_ENV_DEV_SA_KEY_PATH="${CREDENTIALS_FILE}"

gcloud auth activate-service-account --key-file "${CREDENTIALS_FILE}"

previewctl get-credentials --gcp-service-account "${CREDENTIALS_FILE}"
previewctl install-context --gcp-service-account "${CREDENTIALS_FILE}" --timeout 10m

replace="module.preview_gce[0].google_compute_instance.default"

if [[ "${INPUT_RECREATE_VM:-x}" == "true" ]]; then
    export TF_CLI_ARGS_plan="-replace=${replace}"
fi

export TF_VAR_preview_name="$(previewctl get-name --branch "${INPUT_NAME}")"
export TF_INPUT=0
export TF_IN_AUTOMATION=true

leeway run dev/preview:create-preview
