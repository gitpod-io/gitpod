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
leeway build -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build .:docker --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"

cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)
# TODO: replace with for loop over .ideOptions.clients."jetbrains-gateway".desktopIDEs
# second image is always jb-launcher, if position is changed then this script should be updated as well
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.intellij.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.intellij.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.goland.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.goland.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.pycharm.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.pycharm.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.phpstorm.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.phpstorm.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rubymine.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rubymine.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.webstorm.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.webstorm.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rider.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rider.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.clion.imageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.clion.latestImageLayers[1] = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
