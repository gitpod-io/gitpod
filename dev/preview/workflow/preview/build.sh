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
# The files were produced using "git clean -ndfX"
components_dir="$SCRIPT_PATH/../../../../components"
install_dir="$SCRIPT_PATH/../../../../install"
rm -rf \
    "$components_dir/content-service-api/typescript/lib/" \
    "$components_dir/dashboard/build/" \
    "$components_dir/ee/db-sync/lib/" \
    "$components_dir/ee/payment-endpoint/lib/" \
    "$components_dir/gitpod-db/lib/" \
    "$components_dir/gitpod-messagebus/lib/" \
    "$components_dir/gitpod-protocol/lib/" \
    "$components_dir/ide-metrics-api/typescript-grpc/lib/" \
    "$components_dir/ide-metrics-api/typescript-grpcweb/lib/" \
    "$components_dir/ide-service-api/typescript/lib/" \
    "$components_dir/image-builder-api/typescript/lib/" \
    "$components_dir/licensor/typescript/build/" \
    "$components_dir/licensor/typescript/ee/lib/" \
    "$components_dir/licensor/typescript/lib/" \
    "$components_dir/local-app-api/typescript-grpcweb/lib/" \
    "$components_dir/public-api/typescript/lib/" \
    "$components_dir/server/dist/" \
    "$components_dir/supervisor-api/typescript-grpc/lib/" \
    "$components_dir/supervisor-api/typescript-grpcweb/lib/" \
    "$components_dir/supervisor/frontend/dist/" \
    "$components_dir/supervisor/frontend/lib/" \
    "$components_dir/usage-api/typescript/lib/" \
    "$components_dir/ws-daemon-api/typescript/lib/" \
    "$components_dir/ws-manager-api/typescript/lib/" \
    "$components_dir/ws-manager-bridge-api/typescript/lib/" \
    "$components_dir/ws-manager-bridge/dist/" \
    "$install_dir/installer/third_party/charts/docker-registry/Chart.lock" \
    "$install_dir/installer/third_party/charts/docker-registry/charts/" \
    "$install_dir/installer/third_party/charts/minio/Chart.lock" \
    "$install_dir/installer/third_party/charts/minio/charts/" \
    "$install_dir/installer/third_party/charts/mysql/Chart.lock" \
    "$install_dir/installer/third_party/charts/mysql/charts/" \
    "$install_dir/installer/third_party/charts/rabbitmq/Chart.lock" \
    "$install_dir/installer/third_party/charts/rabbitmq/charts/"

leeway build \
    -DSEGMENT_IO_TOKEN="$(kubectl --context=dev -n werft get secret self-hosted -o jsonpath='{.data.segmentIOToken}' | base64 -d)" \
    -DREPLICATED_API_TOKEN="$(kubectl --context=dev -n werft get secret replicated -o jsonpath='{.data.token}' | base64 -d)" \
    -DREPLICATED_APP="$(kubectl --context=dev -n werft get secret replicated -o jsonpath='{.data.app}' | base64 -d)" \
    -Dversion="${VERSION}" \
    --dont-retag \
    --dont-test \
    dev/preview:deploy-dependencies
