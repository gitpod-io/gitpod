#!/usr/bin/env bash
# shellcheck disable=1090

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

auth=$(gcloud config get-value account)
if { [[ "${auth}" != "(unset)" ]] || [ -n "${auth:-}" ]; } && [ -f "${PREVIEW_ENV_DEV_SA_KEY_PATH}" ] && { gcloud projects list >/dev/null 2>&1; }; then
  log_info "Access already configured"
  exit 0
fi

if [[ -z "${PREVIEW_ENV_DEV_CRED:-}" ]] || [[ -z "${PREVIEW_ENV_DEV_SA_KEY_PATH:-}" ]]; then
  log_warn "Neither PREVIEW_ENV_DEV_CRED, nor PREVIEW_ENV_DEV_SA_KEY_PATH is set. Skipping workspace setup."
  exit 0
fi

if [ ! -f "${PREVIEW_ENV_DEV_SA_KEY_PATH}" ]; then
  echo "${PREVIEW_ENV_DEV_CRED}" >"${PREVIEW_ENV_DEV_SA_KEY_PATH}"
fi

gcloud auth login --cred-file "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

if [[ -n "${INSTALL_CONTEXT:-}" ]]; then
  log_info "Starting watch-loop to configure access to your preview environment"
  previewctl install-context --watch
fi
