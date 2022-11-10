#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# This script builds a workspace component and updates the cluster

set -Eeuo pipefail

resource_type=$1
resource_name=$2
enable_debug=${3:-true}
version="dev-$(date +%F_T"%H-%M-%S")"
bldfn="/tmp/build-$version.tar.gz"

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
leeway build .:docker -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev --save "$bldfn" --dont-test
dev_image="$(tar xfO "$bldfn" ./imgnames.txt | head -n1)"

kubectl set image "$resource_type" "$resource_name" "$resource_name"="$dev_image"
kubectl patch "$resource_type" "$resource_name" -p '{"spec":{"containers":{"name":"'"$resource_name"'", "imagePullPolicy": "Always"}}}' --type=merge
kubectl rollout restart "$resource_type" "$resource_name"
kubectl annotate "$resource_type" "$resource_name" kubernetes.io/change-cause="$version"
kubectl rollout status -w "$resource_type" "$resource_name"

while kubectl get pods -l component="$resource_name" | grep -q Terminating;
do
    echo "Waiting for old pods to terminate"
    sleep 3
done
if [[ "$enable_debug" = true ]]; then
    gpctl debug logs "$resource_name" > /dev/null
fi
