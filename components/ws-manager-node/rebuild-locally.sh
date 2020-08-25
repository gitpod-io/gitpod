#!/bin/bash
set -Eeuo pipefail

# ws-manager-node runs as daemonset on each node which renders telepresence useless for debugging.
# This script builds ws-manager-node locally, puts it in a Dockerfile, builds the image, pushes it,
# patches the daemonset and restarts all pods.
#
# This way you can test out your changes with a 30 sec turnaround.
#
# BEWARE: the properly built version of ws-manager-node may behave differently.

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit -1)
gcloud auth list | grep typefox &>/dev/null || (echo "Login using 'gcloud auth login' for the docker push to work"; exit 1)

leeway build .:docker -Dversion=dev
devImage=eu.gcr.io/gitpod-dev/ws-manager-node:dev

kubectl patch daemonset ws-manager-node --patch '{"spec": {"template": {"spec": {"containers": [{"name": "ws-manager-node","image": "'$devImage'"}]}}}}'
kubectl delete pod -l component=ws-manager-node
