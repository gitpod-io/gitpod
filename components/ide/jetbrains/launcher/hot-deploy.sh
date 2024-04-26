#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# This script builds jb-launcher and updates the IDE config map.

# TODO(AK) optimize to produce a new version only if launcher was rebuilt
version="dev-jb-launcher-$(date +%F_T"%H-%M-%S")"
echo "Image Version: $version"

bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
leeway build -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-dev-artifact/build .:docker --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"

cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)
ides=$(echo "$cf_patch" |jq '.ideOptions.clients."jetbrains-gateway".desktopIDEs')
for ide in $(echo "$ides" | jq -r '.[]'); do
  # second image is always jb-launcher, if position is changed then this script should be updated as well
  cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.${ide}.imageLayers[1] = \"$dev_image\"")
  cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.${ide}.latestImageLayers[1] = \"$dev_image\"")
done

cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
