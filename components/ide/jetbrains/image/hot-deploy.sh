#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# Login in GCloud to reuse remote caches
ROOT_DIR="$(dirname "$0")/../../../.."

source "$ROOT_DIR/dev/preview/workflow/lib/ensure-gcloud-auth.sh"
ensure_gcloud_auth

# This script builds the backend JB ide image and updates the IDE config map.

product=${1:-intellij}
echo "Product: $product"

qualifier=${2:-latest}
echo "Qualifier: $qualifier"

product_code=${3}
echo "Product Code: $product_code"

if [ "$qualifier" == "stable" ]; then
    component=$product
else
    component=$product-$qualifier
fi

version="dev-$component-image-$(date +%F_T"%H-%M-%S")"
echo "Image Version: $version"

bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
IDE_VERSIONS_JSON=$(bash "$ROOT_DIR/components/ide/jetbrains/image/resolve-latest-ide-version.sh" "$product_code")
IDE_BUILD_VERSION=$(echo "$IDE_VERSIONS_JSON" | jq -r .IDE_BUILD_VERSION)
IDE_VERSION=$(echo "$IDE_VERSIONS_JSON" | jq -r .IDE_VERSION)
leeway build -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-dev-artifact/build -DbuildNumber="$IDE_BUILD_VERSION" -DjbBackendVersion="$IDE_VERSION" ".:$component" --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"

if [ "$qualifier" == "stable" ]; then
    prop="image"
else
    prop="latestImage"
fi

cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.$product.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
