#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../../util/preview-name-from-branch.sh
source "$(realpath "${SCRIPT_PATH}/../../util/preview-name-from-branch.sh")"

import "ensure-gcloud-auth.sh"

ensure_gcloud_auth

VERSION="$(preview-name-from-branch)-dev"

leeway build \
    -DSEGMENT_IO_TOKEN="" \
    -Dversion="${VERSION}" \
    --dont-retag \
    --dont-test \
    install/installer:app
