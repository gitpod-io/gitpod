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
leeway build -DnoVerifyJBPlugin=true -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-dev-artifact/build .:"$qualifier" --save "$bldfn"
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"
echo "Dev Image: $dev_image"

ide_list=("intellij" "goland" "pycharm" "phpstorm" "rubymine" "webstorm" "rider" "clion")

if [ "$qualifier" == "stable" ]; then
  prop_list=("pluginImage" "imageLayers[0]")
else
  prop_list=("pluginLatestImage" "latestImageLayers[0]")
fi

cf_patch=$(kubectl get cm ide-config -o=json | jq '.data."config.json"' |jq -r)

for ide in "${ide_list[@]}"; do
  for prop in "${prop_list[@]}"; do
    cf_patch=$(echo "$cf_patch" | jq ".ideOptions.options.$ide.$prop = \"$dev_image\"")
  done
done

cf_patch=$(echo "$cf_patch" |jq tostring)
cf_patch="{\"data\": {\"config.json\": $cf_patch}}"

kubectl patch cm ide-config --type=merge -p "$cf_patch"

kubectl rollout restart deployment ide-service
kubectl rollout restart deployment server
