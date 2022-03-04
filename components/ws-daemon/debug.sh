#!/bin/bash

# ws-daemon runs as daemonset on each node which renders telepresence useless for debugging.
# This script builds ws-daemon locally, puts it in a Dockerfile, builds the image, pushes it,
# patches the daemonset and restarts all pods.
#
# This way you can test out your changes with a 30 sec turnaround.
#
# BEWARE: the properly built version of ws-daemon may behave differently.

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
gcloud auth list | grep typefox &>/dev/null || (echo "Login using 'gcloud auth login' for the docker push to work"; exit 1)

leeway build .:docker -Dversion=dev
devImage=eu.gcr.io/gitpod-dev/ws-daemon:dev

kubectl patch daemonset ws-daemon --patch '{"spec": {"template": {"spec": {"containers": [{"name": "ws-daemon","image": "'$devImage'"}]}}}}'
kubectl get pods --no-headers -o=custom-columns=:metadata.name | grep ws-daemon | xargs kubectl delete pod
