#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# This script builds the backend plugin and updates the IDE config map.

qualifier=${1:-latest}
echo "Plugin Qualifier: $qualifier"

# TODO(AK) optimize to produce a new version only if plugin was rebuilt
version="dev-jb-backend-plugin-$(date +%F_T"%H-%M-%S")"
echo "Image Version: $version"

bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
leeway build -DnoVerifyJBPlugin=true -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build .:"$qualifier" --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"

if [ "$qualifier" == "stable" ]; then
    prop="pluginImage"
else
    prop="pluginLatestImage"
fi

cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.intellij.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.goland.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.pycharm.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.phpstorm.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rubymine.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.webstorm.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.rider.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq ".ideOptions.options.clion.$prop = \"$dev_image\"")
cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
