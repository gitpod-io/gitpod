#!/usr/bin/env bash

set -euo pipefail

# shellcheck disable=SC2155
export VERSION="${INPUT_VERSION}"
export PATH="$PATH:$HOME/bin"

mkdir "$HOME/bin"

echo "Downloading installer for ${VERSION}"
oci-tool fetch file -o "$HOME/bin/installer" --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" app/installer
chmod +x "$HOME/bin/installer"

echo "Download versions.yaml"
oci-tool fetch file -o /tmp/versions.yaml --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/versions:${VERSION}" versions.yaml

export PREVIEW_ENV_DEV_SA_KEY_PATH="$GOOGLE_APPLICATION_CREDENTIALS"

gcloud auth activate-service-account --key-file "${GOOGLE_APPLICATION_CREDENTIALS}"

echo "Previewctl get-credentials"
previewctl get-credentials --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"
echo "Previewctl install-context"
previewctl install-context  --timeout 10m --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"

PREVIEW_NAME="$(previewctl get-name --branch "${INPUT_NAME}")"
export PREVIEW_NAME

for var in WITH_DEDICATED_EMU ANALYTICS WORKSPACE_FEATURE_FLAGS; do
  input_var="INPUT_${var}"
  if [[ -n "${!input_var:-}" ]];then
    export "GITPOD_${var}"="${!input_var}"
  fi
done

previewctl install-context --branch "${PREVIEW_NAME}" --log-level debug --timeout 10m --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"
leeway run dev/preview:deploy-gitpod
previewctl report >> "${GITHUB_STEP_SUMMARY}"

EOF=$(dd if=/dev/urandom bs=15 count=1 status=none | base64)
report=$(previewctl report | base64)
{
  echo "report<<$EOF"
  echo "$report"
  echo "$EOF"
} >> "$GITHUB_OUTPUT"
