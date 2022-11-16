#!/usr/bin/env bash
# shellcheck disable=1091

set -euo pipefail

ROOT="$(realpath "$(dirname "$0")")/../../../../"

source "${ROOT}/dev/preview/workflow/lib/ensure-gcloud-auth.sh"
source "${ROOT}/dev/preview/workflow/lib/common.sh"
source "${ROOT}/dev/preview/workflow/lib/git.sh"

# Don't prompt user before terraform apply
export TF_INPUT=0
export TF_IN_AUTOMATION=true

if git:is-on-main; then
    log_error "We don't support running dev:preview from the main branch. Please switch to another branch."
    exit 1
fi

if ! git:branch-exists-remotely; then
    log_warn "Your branch doesn't exist on GitHub. Your preview environment might get garbage collected at any time. To avoid this please push your branch."
fi

ensure_gcloud_auth

leeway run dev/preview:create-preview
leeway run dev/preview:build
previewctl install-context
leeway run dev/preview:deploy-gitpod
