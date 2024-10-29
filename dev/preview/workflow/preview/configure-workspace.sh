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

if [ -z "${PREVIEW_ENV_DEV_SA_KEY_PATH:-}" ]; then
  log_warn "PREVIEW_ENV_DEV_SA_KEY_PATH is not set. Skipping workspace setup."
  exit 0
fi

if [ -f "/usr/local/gitpod/config/initial-spec.json" ]; then
  gcloud iam workload-identity-pools create-cred-config \
    projects/184212049955/locations/global/workloadIdentityPools/gitpod-flex/providers/gitpod-flex-provider \
    --service-account=preview-environmnet-dev@gitpod-dev-preview.iam.gserviceaccount.com \
    --service-account-token-lifetime-seconds=1h \
    --output-file="${PREVIEW_ENV_DEV_SA_KEY_PATH}" \
    --executable-command='node /workspace/gitpod/dev/flex-oidc/oidc.js' \
    --executable-timeout-millis=5000
elif [[ -n "${PREVIEW_ENV_DEV_CRED:-}" ]]; then
  echo "${PREVIEW_ENV_DEV_CRED}" >"${PREVIEW_ENV_DEV_SA_KEY_PATH}"
fi

if [ ! -f "${PREVIEW_ENV_DEV_SA_KEY_PATH}" ]; then
  log_warn "Neither PREVIEW_ENV_DEV_CRED, nor PREVIEW_ENV_DEV_SA_KEY_PATH is set. Skipping workspace setup."
  exit 0
fi

gcloud auth login --cred-file "${PREVIEW_ENV_DEV_SA_KEY_PATH}" --activate --quiet

if [[ -n "${INSTALL_CONTEXT:-}" ]]; then
  log_info "Starting watch-loop to configure access to your preview environment"
  previewctl install-context --watch
fi
