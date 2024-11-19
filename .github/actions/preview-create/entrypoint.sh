#!/usr/bin/env bash

set -euo pipefail

export HOME=/home/gitpod
# shellcheck disable=SC2155
export LEEWAY_WORKSPACE_ROOT="$(pwd)"
export PATH="$PATH:$HOME/bin"

mkdir $HOME/bin

gcloud auth login --cred-file="$GOOGLE_APPLICATION_CREDENTIALS" --activate --quiet
leeway run dev/preview/previewctl:install

TF_VAR_preview_name="$(previewctl get-name --branch "${INPUT_NAME}")"
export TF_VAR_preview_name
export TF_VAR_with_large_vm="${INPUT_LARGE_VM}"
export TF_VAR_gce_use_spot="${INPUT_PREEMPTIBLE}"
export TF_INPUT=0
export TF_IN_AUTOMATION=true
leeway run dev/preview:create-preview
