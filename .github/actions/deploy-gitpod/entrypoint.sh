#!/usr/bin/env bash

set -euo pipefail

export HOME=/home/gitpod
export PREVIEW_ENV_DEV_SA_KEY_PATH="$HOME/.config/gcloud/preview-environment-dev-sa.json"
# shellcheck disable=SC2155
export LEEWAY_WORKSPACE_ROOT="$(pwd)"
export VERSION="${INPUT_VERSION}"
export IMAGE_REPO_BASE="${INPUT_IMAGE_REPO_BASE}"
export PATH="$PATH:$HOME/bin"

mkdir $HOME/bin

echo "Downloading installer for ${VERSION}"
oci-tool fetch file -o $HOME/bin/installer --platform=linux-amd64 "${IMAGE_REPO_BASE}/installer:${VERSION}" app/installer
chmod +x $HOME/bin/installer

echo "Download versions.yaml"
oci-tool fetch file -o /tmp/versions.yaml --platform=linux-amd64 "${IMAGE_REPO_BASE}/versions:${VERSION}" versions.yaml

gcloud auth login --cred-file="$GOOGLE_APPLICATION_CREDENTIALS" --activate --quiet
leeway run dev/preview/previewctl:install

PREVIEW_NAME="$(previewctl get-name --branch "${INPUT_NAME}")"
export PREVIEW_NAME

for var in WITH_DEDICATED_EMU ANALYTICS WORKSPACE_FEATURE_FLAGS; do
  input_var="INPUT_${var}"
  if [[ -n "${!input_var:-}" ]];then
    export "GITPOD_${var}"="${!input_var}"
  fi
done

previewctl install-context --branch "${PREVIEW_NAME}" --log-level debug --timeout 10m
leeway run dev/preview:deploy-gitpod
previewctl report --branch "${PREVIEW_NAME}" >> "${GITHUB_STEP_SUMMARY}"

EOF=$(dd if=/dev/urandom bs=15 count=1 status=none | base64)
report=$(previewctl report --branch "${PREVIEW_NAME}" | base64)
{
  echo "report<<$EOF"
  echo "$report"
  echo "$EOF"
} >> "$GITHUB_OUTPUT"
