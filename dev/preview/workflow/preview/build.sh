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

# We have quite a few Leeway packages whose hash includes files from .gitignore.
# Some of these files (such as build folders) are populated as part of our prebuilds
# which means that the hash for these components will be different from a workspace
# then in CI.
#
# We should fix the package definitions so that they don't include these files in the hash.
#
# For now we're simply cleaning the repository by deleting all files that are in .gitignore.
git clean -dfX

leeway build \
    -DSEGMENT_IO_TOKEN="$(kubectl --context=dev -n werft get secret self-hosted -o jsonpath='{.data.segmentIOToken}' | base64 -d)" \
    -DREPLICATED_API_TOKEN="$(kubectl --context=dev -n werft get secret replicated -o jsonpath='{.data.token}' | base64 -d)" \
    -DREPLICATED_APP="$(kubectl --context=dev -n werft get secret replicated -o jsonpath='{.data.app}' | base64 -d)" \
    -Dversion="${VERSION}" \
    --dont-retag \
    --dont-test \
    install/installer:app
