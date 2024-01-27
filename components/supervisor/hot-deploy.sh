#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# Login in GCloud to reuse remote caches
ROOT_DIR="$(dirname "$0")/../.."

source "$ROOT_DIR/dev/preview/workflow/lib/ensure-gcloud-auth.sh"
ensure_gcloud_auth

# This script builds the supervisor and updates the IDE config map.

version="dev-supervisor-$(date +%F_T"%H-%M-%S")"
echo "Image Version: $version"

bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
leeway build -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build .:docker --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"


cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)
cf_patch=$(echo "$cf_patch" |jq ".supervisorImage = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
