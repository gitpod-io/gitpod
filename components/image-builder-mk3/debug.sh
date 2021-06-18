#!/bin/bash

# This script builds the image builder and replaces the current deployment with it.

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
gcloud auth list | grep typefox &>/dev/null || (echo "Login using 'gcloud auth login' for the docker push to work"; exit 1)

leeway build .:docker -Dversion=dev
devImage=eu.gcr.io/gitpod-dev/image-builder:dev

kubectl patch deployment image-builder --patch '{"spec": {"template": {"spec": {"containers": [{"name": "service","image": "'$devImage'"}]}}}}'
kubectl get pods --no-headers -o=custom-columns=:metadata.name | grep image-builder | xargs kubectl delete pod