#!/bin/bash

# ws-daemon runs as daemonset on each node which renders telepresence useless for debugging.
# This script builds ws-daemon locally, puts it in a Dockerfile, builds the image, pushes it,
# patches the daemonset and restarts all pods.
#
# This way you can test out your changes with a 30 sec turnaround.
#
# BEWARE: the properly built version of ws-daemon may behave differently.

set -Eeuo pipefail

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)

version=dev-0
leeway build .:docker -Dversion="$version" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/dev
devImage=eu.gcr.io/gitpod-core-dev/dev/ws-daemon:"$version"

kubectl set image daemonset ws-daemon ws-daemon="$devImage"
kubectl annotate daemonset ws-daemon kubernetes.io/change-cause="$version"
kubectl rollout restart daemonset ws-daemon
