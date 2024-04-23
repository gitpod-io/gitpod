#!/usr/bin/env bash
# shellcheck disable=1091

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

import "ensure-gcloud-auth.sh"

leeway run dev/preview:configure-workspace
ensure_gcloud_auth

PREVIEW_GCP_PROJECT=gitpod-dev-preview

if [[ "${VERSION:-}" == "" ]]; then
    VERSION="$(previewctl get name)-dev-$(date +%F_T%H-%M-%S)"
    log_info "VERSION is not set - using $VERSION"
    echo "$VERSION" > /tmp/local-dev-version
fi

leeway build \
    -DSEGMENT_IO_TOKEN="$(gcloud secrets versions access latest --project ${PREVIEW_GCP_PROJECT} --secret=segment-io-token)" \
    -Dversion="${VERSION}" \
    --dont-test \
    dev/preview:deploy-dependencies
