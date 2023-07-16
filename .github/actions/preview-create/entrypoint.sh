#!/usr/bin/env bash

set -euo pipefail

leeway run dev/preview/previewctl:download

previewctl get-credentials --gcp-service-account "${INPUT_SA_KEY}"

replace="module.preview_gce[0].google_compute_instance.default"
if [[ "${INPUT_INFRASTRUCTURE_PROVIDER}" = "harvester " ]]; then
    replace="module.preview_harvester[0].harvester_virtualmachine.harvester"
fi

if [[ "${INPUT_RECREATE_VM:-x}" == "true" ]]; then
    export TF_CLI_ARGS_plan="-replace=${replace}"
fi

TF_VAR_preview_name="$(previewctl get-name --branch "${INPUT_NAME}")"
export TF_VAR_preview_name
export TF_VAR_infra_provider="${INPUT_INFRASTRUCTURE_PROVIDER}"
export TF_VAR_with_large_vm="${INPUT_LARGE_VM}"
export TF_INPUT=0
export TF_IN_AUTOMATION=true

leeway run dev/preview:create-preview
