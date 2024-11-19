#!/usr/bin/env bash
# shellcheck disable=1091
# shellcheck disable=1090

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# Ensure components/gitpod-db:dbtest-init works
export DB_HOST="${DB_HOST:-127.0.0.1}"

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

import "ensure-gcloud-auth.sh"
import "git.sh"

# Don't prompt user before terraform apply
export TF_INPUT=0
export TF_IN_AUTOMATION=true

if git:is-on-main; then
  log_error "We don't support running dev:preview from the main branch. Please switch to another branch."
  exit 1
fi

if ! git:branch-exists-remotely; then
  log_warn "Your branch doesn't exist on GitHub. Your preview environment WILL get garbage collected after AT MOST 1h. To avoid this please push your branch."
  ask "I've read 👆 and I understand the implications."
fi

leeway run dev/preview:configure-workspace
ensure_gcloud_auth

leeway run dev/preview:create-preview dev/preview:build
previewctl install-context --timeout 10m
leeway run dev/preview:deploy-gitpod
