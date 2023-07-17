#!/usr/bin/env bash
# shellcheck disable=SC2155

set -euo pipefail
set -x

export PREVIEW_ENV_DEV_SA_KEY_PATH="$GOOGLE_APPLICATION_CREDENTIALS"

gcloud auth activate-service-account --key-file "${GOOGLE_APPLICATION_CREDENTIALS}"

echo "Previewctl get-credentials"
previewctl get-credentials --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"
echo "Previewctl install-context"
previewctl install-context --log-level debug --timeout 10m --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"

replace="module.preview_gce[0].google_compute_instance.default"

if [[ "${INPUT_RECREATE_VM:-x}" == "true" ]]; then
  export TF_CLI_ARGS_plan="-replace=${replace}"
fi

export TF_VAR_preview_name="$(previewctl get-name --branch "${INPUT_NAME}")"
export TF_VAR_with_large_vm="${INPUT_LARGE_VM}"
export TF_INPUT=0
export TF_IN_AUTOMATION=true

leeway run dev/preview:create-preview
