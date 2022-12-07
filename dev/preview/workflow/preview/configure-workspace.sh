#!/usr/bin/env bash
# shellcheck disable=1090

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

auth=$(gcloud config get-value account)
if { [[ "${auth}" != "(unset)" ]] || [ -n "${auth:-}" ]; } && [ -f "${PREVIEW_ENV_DEV_SA_KEY_PATH}" ] && { previewctl has-access; }; then
  log_info "Access already configured"
  exit 0
fi

if [[ -z "${PREVIEW_ENV_DEV_SA_KEY:-}" ]] || [[ -z "${PREVIEW_ENV_DEV_SA_KEY_PATH:-}" ]]; then
  log_warn "Neither PREVIEW_ENV_DEV_SA_KEY, nor PREVIEW_ENV_DEV_SA_KEY_PATH is set. Skipping workspace setup."
  exit 0
fi

if [ ! -f "${PREVIEW_ENV_DEV_SA_KEY_PATH}" ]; then
  echo "${PREVIEW_ENV_DEV_SA_KEY}" >"${PREVIEW_ENV_DEV_SA_KEY_PATH}"
fi

gcloud auth activate-service-account --key-file "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

log_info "Configuring access to kubernetes clusters"
previewctl get-credentials --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}"

if [[ -n "${INSTALL_CONTEXT:-}" ]]; then
  log_info "Starting watch-loop to configure access to your preview environment"
  previewctl install-context --gcp-service-account "${PREVIEW_ENV_DEV_SA_KEY_PATH}" --watch
fi
