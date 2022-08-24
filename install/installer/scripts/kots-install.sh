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
/app/installer validate config -c "${CONFIG_FILE}"

echo "Gitpod: render Kubernetes manifests"
/app/installer render -c "${CONFIG_FILE}" --namespace "${NAMESPACE}" --use-experimental-config >> "${GITPOD_OBJECTS}/templates/gitpod.yaml"

if [ "${INSTALLER_DRY_RUN}" = "true" ]; then
    echo "Gitpod: dry-run set to true, no installation will be performed"
    exit
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
