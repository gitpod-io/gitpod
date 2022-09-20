#!/bin/sh
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

set -e

echo "Gitpod: Killing any in-progress installations"

kubectl delete jobs.batch -n "${NAMESPACE}" -l component="gitpod-installer,cursor!=${CURSOR}" --force --grace-period 0 || true
kubectl delete pod -n "${NAMESPACE}" -l component="gitpod-installer,cursor!=${CURSOR}" --force --grace-period 0 || true

if [ "$(helm status -n "${NAMESPACE}" gitpod -o json | jq '.info.status == "deployed"')" = "false" ];
then
    echo "Gitpod: Deployment in-progress - clearing"

    VERSION="$(helm status -n "${NAMESPACE}" gitpod -o json | jq '.version')"
    if [ "${VERSION}" -le 1 ];
    then
        echo "Gitpod: Uninstall application"
        helm uninstall -n "${NAMESPACE}" gitpod --wait || true
    else
        echo "Gitpod: Rolling back application"
        helm rollback -n "${NAMESPACE}" gitpod --wait || true
    fi
fi

echo "Gitpod: Create a Helm template directory"
rm -Rf "${GITPOD_OBJECTS}"
mkdir -p "${GITPOD_OBJECTS}/templates"
cat <<EOF >> "${GITPOD_OBJECTS}/Chart.yaml"
apiVersion: v2
name: gitpod-kots
description: Always ready-to-code
version: "1.0.0"
appVersion: "$(/app/installer version | yq e '.version' -)"
EOF

echo "Gitpod: Generate the base Installer config"
/app/installer config init

echo "Gitpod: auto-detecting ShiftFS support on host machine"
/app/installer config cluster shiftfs

echo "Gitpod: auto-detecting containerd settings on host machine"
/app/installer config files containerd

echo "Gitpod: auto-detecting settings"
/app/installer config build-from-envvars

echo "Gitpod: Validate config"
/app/installer validate config

echo "Gitpod: render Kubernetes manifests"
/app/installer render --use-experimental-config > "${GITPOD_OBJECTS}/templates/gitpod.yaml"

if [ "${INSTALLER_DRY_RUN}" = "true" ]; then
    echo "Gitpod: dry-run set to true, no installation will be performed"
    exit
fi

# Combine the pull secrets
echo "${LOCAL_REGISTRY_IMAGE_PULL_DOCKER_CONFIG_JSON}" > /tmp/kotsregistry.json
if [ "${REG_INCLUSTER_ENABLED}" = "1" ]; then
    echo "Gitpod: Add the local registry secret to the in-cluster registry secret"

    # Get the in-cluster registry secret
    yq eval-all '(select(.kind == "Secret" and .metadata.name == "builtin-registry-auth") | .data.".dockerconfigjson")' \
        "${GITPOD_OBJECTS}/templates/gitpod.yaml" \
        | base64 -d \
        > /tmp/gitpodregistry.json

    REGISTRY_SECRET="$(cat /tmp/kotsregistry.json /tmp/gitpodregistry.json | jq -s '.[0] * .[1]' - - | base64 -w 0)"
    export REGISTRY_SECRET

    echo "Gitpod: update the in-cluster registry secret"
    yq eval-all --inplace '(select(.kind == "Secret" and .metadata.name == "builtin-registry-auth") | .data.".dockerconfigjson") |= env(REGISTRY_SECRET)' \
        "${GITPOD_OBJECTS}/templates/gitpod.yaml"
else
    echo "Gitpod: configuring external container registry"

    # Get the external-container-registry secret so we can merge the external registry and KOTS registry keys
    echo "${EXTERNAL_DOCKER_CONFIG_JSON}" > /tmp/gitpodregistry.json

    cat /tmp/kotsregistry.json /tmp/gitpodregistry.json | jq -s '.[0] * .[1]' - - > /tmp/container-registry-secret

    echo "Gitpod: append the container-registry secret"
    echo "---" >> "${GITPOD_OBJECTS}/templates/gitpod.yaml"
    kubectl create secret docker-registry "${REG_EXTERNAL_CERTIFICATE_NAME}" \
        --namespace "${NAMESPACE}" \
        --from-file=.dockerconfigjson=/tmp/container-registry-secret \
        -o yaml --dry-run=client >> "${GITPOD_OBJECTS}/templates/gitpod.yaml"
fi

if [ "${REG_DOCKER_CONFIG_ENABLED}" = "1" ];
then
    # Work out the registry secret to use
    if [ "${REG_INCLUSTER_ENABLED}" = "0" ];
    then
        export REGISTRY_SECRET_NAME="${REG_EXTERNAL_CERTIFICATE_NAME}"
    else
        export REGISTRY_SECRET_NAME="builtin-registry-auth"
    fi

    echo "Gitpod: Add given extra docker config JSON file to ${REGISTRY_SECRET_NAME}"
    yq eval-all '(select(.kind == "Secret" and .metadata.name == env(REGISTRY_SECRET_NAME)) | .data.".dockerconfigjson")' \
        "${GITPOD_OBJECTS}/templates/gitpod.yaml" \
        | base64 -d \
        > /tmp/currentconfig.json

    echo "Gitpod: update the in-cluster registry secret"
    REGISTRY_SECRET="$(jq -s '.[0] * .[1]' /tmp/userconfig.json /tmp/currentconfig.json | base64 -w 0)"
    export REGISTRY_SECRET
    yq eval-all --inplace '(select(.kind == "Secret" and .metadata.name == env(REGISTRY_SECRET_NAME)) | .data.".dockerconfigjson") |= env(REGISTRY_SECRET)' \
        "${GITPOD_OBJECTS}/templates/gitpod.yaml"
fi

echo "Gitpod: Escape any Golang template values"
# shellcheck disable=SC2016
sed -i -r 's/(.*\{\{.*)/{{`\1`}}/' "${GITPOD_OBJECTS}/templates/gitpod.yaml"

# If certificate secret already exists, set the timeout to 5m
CERT_SECRET=$(kubectl get secrets -n "${NAMESPACE}" https-certificates -o jsonpath='{.metadata.name}' || echo '')
HELM_TIMEOUT="5m"
if [ "${CERT_SECRET}" = "" ]; then
    HELM_TIMEOUT="1h"
fi

# The long timeout is to ensure the TLS cert is created (if required)
echo "Gitpod: Apply the Kubernetes objects with timeout of ${HELM_TIMEOUT}"
helm upgrade \
    --atomic \
    --cleanup-on-fail \
    --create-namespace \
    --install \
    --namespace="${NAMESPACE}" \
    --reset-values \
    --timeout "${HELM_TIMEOUT}" \
    --wait \
    gitpod \
    "${GITPOD_OBJECTS}"

echo "Gitpod: Restarting installation status job"
kubectl delete pod -n "${NAMESPACE}" -l component=gitpod-installer-status || true
