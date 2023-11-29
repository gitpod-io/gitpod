#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# This script builds the proxy image and start it locally

set -Eeuo pipefail

version="dev-$(date +%F_T"%H-%M-%S")"
bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
leeway build .:docker -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev --save "$bldfn" --dont-test
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"

docker run --rm -e GITPOD_DOMAIN -e WORKSPACE_HANDLER_FILE -e KUBE_NAMESPACE -e KUBE_DOMAIN -v $PWD/dev-configcat:/data/configcat --network host "$dev_image"
