#!/usr/bin/env bash

set -euo pipefail

export HOME=/home/gitpod
export PREVIEW_ENV_DEV_SA_KEY_PATH="$HOME/.config/gcloud/preview-environment-dev-sa.json"

export VERSION="${INPUT_VERSION}"

mkdir $HOME/bin
export PATH="$PATH:$HOME/bin"

echo "Downloading installer for ${VERSION}"
oci-tool fetch file -o $HOME/bin/installer --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" app/installer
chmod +x $HOME/bin/installer

echo "Download versions.yaml"
oci-tool fetch file -o /tmp/versions.yaml --platform=linux-amd64 "eu.gcr.io/gitpod-core-dev/build/versions:${VERSION}" versions.yaml

echo "${INPUT_SA_KEY}" > "${PREVIEW_ENV_DEV_SA_KEY_PATH}"
gcloud auth activate-service-account --key-file "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

# Hack alert: We're building previewctl here until we decide how to properly distribute internal tools
# Also, LEEWAY_WORKSPACE_ROOT is set to /workspace/gitpod in our dev image, but that's not the path GH actions use
# shellcheck disable=SC2155
export LEEWAY_WORKSPACE_ROOT="$(pwd)"
leeway run dev/preview/previewctl:install --dont-test

echo "Setting up access to core-dev and harvester"
previewctl get-credentials --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

echo "Install kubectx for the preview environment"
previewctl install-context --log-level debug --timeout 10m --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

leeway run dev/preview:deploy-gitpod
previewctl report >> "${GITHUB_STEP_SUMMARY}"
