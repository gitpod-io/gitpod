#!/bin/bash

# This script builds the image builder and replaces the current deployment with it.

docker ps &> /dev/null || (echo "You need a working Docker daemon. Maybe set DOCKER_HOST?"; exit 1)
gcloud auth list | grep typefox &>/dev/null || (echo "Login using 'gcloud auth login' for the docker push to work"; exit 1)


readonly tag
tag="dev-$(date +%s)"
leeway build -v .:docker -Dversion="${tag}" -DimageRepoBase=eu.gcr.io/gitpod-core-dev/build
devImage="eu.gcr.io/gitpod-core-dev/build/image-builder-mk3:${tag}"

kubectl patch deployment image-builder-mk3 --patch '{"spec": {"template": {"spec": {"containers": [{"name": "image-builder-mk3","imagePullPolicy":"Always","image": "'"$devImage"'"}]}}}}'
kubectl rollout restart deployment/image-builder-mk3
kubectl rollout status -w deployment/image-builder-mk3
# give the old pod time to disappear
sleep 20
gpctl debug logs image-builder-mk3