#!/usr/bin/env bash

set -euo pipefail

export HOME=/home/gitpod
export PREVIEW_ENV_DEV_SA_KEY_PATH="$HOME/.config/gcloud/preview-environment-dev-sa.json"
# shellcheck disable=SC2155
export LEEWAY_WORKSPACE_ROOT="$(pwd)"
export VERSION="${INPUT_VERSION}"
export PATH="$PATH:$HOME/bin"

mkdir $HOME/bin

echo "Downloading installer for ${VERSION}"
oci-tool fetch file -o $HOME/bin/installer --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" app/installer
chmod +x $HOME/bin/installer

echo "Download versions.yaml"
oci-tool fetch file -o /tmp/versions.yaml --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/versions:${VERSION}" versions.yaml

echo "${INPUT_SA_KEY}" > "${PREVIEW_ENV_DEV_SA_KEY_PATH}"
gcloud auth activate-service-account --key-file "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

leeway run dev/preview/previewctl:download

echo "Setting up access to core-dev and harvester"
previewctl get-credentials --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

PREVIEW_NAME="$(previewctl get-name --branch "${INPUT_NAME}")"
export PREVIEW_NAME

for var in WSMANAGER_MK2 WITH_DEDICATED_EMU WITH_EE_LICENSE ANALYTICS WORKSPACE_FEATURE_FLAGS; do
  input_var="INPUT_${var}"
  if [[ -n "${!input_var:-}" ]];then
    export GITPOD_${var}=${!input_var}
  fi
done

previewctl install-context --branch "${PREVIEW_NAME}" --log-level debug --timeout 10m --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}"
leeway run dev/preview:deploy-gitpod
previewctl report >> "${GITHUB_STEP_SUMMARY}"
