#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../../util/preview-name-from-branch.sh
source "$(realpath "${SCRIPT_PATH}/../../util/preview-name-from-branch.sh")"

VERSION="$(preview-name-from-branch)-dev"
INSTALLER_HASH=$(
    leeway describe install/installer:app \
        -Dversion="${VERSION}" \
        -DSEGMENT_IO_TOKEN="" \
        --format=json \
    | jq -r '.metadata.version'
)
INSTALLER_CONFIG_PATH=/tmp/$(mktemp "XXXXXX.gitpod.config.yaml")

function installer {
    "/tmp/build/install-installer--app.$INSTALLER_HASH/installer" "$@"
}

installer config init --overwrite --config "$INSTALLER_CONFIG_PATH"
log_success "Generated config at $INSTALLER_CONFIG_PATH"
