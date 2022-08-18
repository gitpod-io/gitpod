#!/bin/sh
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

# shellcheck disable=SC2050,SC2153

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
/app/installer init > "${CONFIG_FILE}"

echo "Gitpod: auto-detecting ShiftFS support on host machine"
kubectl wait job -n "${NAMESPACE}" --for=condition=complete -l component=shiftfs-module-loader --timeout=30s || true
ENABLE_SHIFTFS=$(kubectl get jobs.batch -n "${NAMESPACE}" -l component=shiftfs-module-loader -o jsonpath='{.items[0].status.succeeded}')

if [ "${ENABLE_SHIFTFS}" = "1" ]; then
    echo "Gitpod: enabling ShiftFS support"

    yq e -i '.workspace.runtime.fsShiftMethod = "shiftfs"' "${CONFIG_FILE}"
fi

echo "Gitpod: auto-detecting containerd location on host machine"
if [ -d "/mnt/node0${CONTAINERD_DIR_K3S}" ]; then
    echo "Gitpod: containerd dir detected as k3s"

    yq e -i ".workspace.runtime.containerdRuntimeDir = \"${CONTAINERD_DIR_K3S}\"" "${CONFIG_FILE}"
elif [ -d "/mnt/node0${CONTAINERD_DIR_AL}" ]; then
    echo "Gitpod: containerd dir detected as ${CONTAINERD_DIR_AL}"

    yq e -i ".workspace.runtime.containerdRuntimeDir = \"${CONTAINERD_DIR_AL}\"" "${CONFIG_FILE}"
fi

if [ -S "/mnt/node0${CONTAINERD_SOCKET_K3S}" ]; then
    echo "Gitpod: containerd socket detected as k3s"

    yq e -i ".workspace.runtime.containerdSocket = \"${CONTAINERD_SOCKET_K3S}\"" "${CONFIG_FILE}"
elif [ -S "/mnt/node0${CONTAINERD_SOCKET_AL}" ]; then
    echo "Gitpod: containerd socket detected as ${CONTAINERD_SOCKET_AL}"

    yq e -i ".workspace.runtime.containerdSocket = \"${CONTAINERD_SOCKET_AL}\"" "${CONFIG_FILE}"
fi

echo "Gitpod: Inject the Replicated variables into the config"
yq e -i ".domain = \"${DOMAIN}\"" "${CONFIG_FILE}"
yq e -i '.license.kind = "secret"' "${CONFIG_FILE}"
yq e -i '.license.name = "gitpod-license"' "${CONFIG_FILE}"

if [ "${OPEN_VSX_URL}" != "" ];
then
    echo "Gitpod: Setting Open VSX Registry URL"
    yq e -i ".openVSX.url = \"${OPEN_VSX_URL}\"" "${CONFIG_FILE}"
fi

if [ "${DB_INCLUSTER_ENABLED}" = "0" ] && [ "${DB_CLOUDSQL_INSTANCE}" != "" ];
then
    echo "Gitpod: configuring CloudSQLProxy"

    yq e -i ".database.inCluster = false" "${CONFIG_FILE}"
    yq e -i ".database.cloudSQL.instance = \"${DB_CLOUDSQL_INSTANCE}\"" "${CONFIG_FILE}"
    yq e -i ".database.cloudSQL.serviceAccount.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".database.cloudSQL.serviceAccount.name = \"cloudsql\"" "${CONFIG_FILE}"
fi

if [ "${DB_INCLUSTER_ENABLED}" = "0" ] && [ "${DB_CLOUDSQL_INSTANCE}" = "" ];
then
    echo "Gitpod: configuring external database"

    yq e -i ".database.inCluster = false" "${CONFIG_FILE}"
    yq e -i ".database.external.certificate.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".database.external.certificate.name = \"database\"" "${CONFIG_FILE}"
fi

if [ "${HAS_LOCAL_REGISTRY}" = "true" ];
then
    echo "Gitpod: configuring mirrored container registry for airgapped installation"

    yq e -i ".repository = \"${LOCAL_REGISTRY_ADDRESS}\"" "${CONFIG_FILE}"
    yq e -i ".imagePullSecrets[0].kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".imagePullSecrets[0].name = \"${IMAGE_PULL_SECRET_NAME}\"" "${CONFIG_FILE}"
    yq e -i '.dropImageRepo = true' "${CONFIG_FILE}"

    # Add the registry to the server allowlist - keep docker.io in case it's just using the mirrored registry functionality without being airgapped
    yq e -i ".containerRegistry.privateBaseImageAllowList += \"${LOCAL_REGISTRY_HOST}\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.privateBaseImageAllowList += \"docker.io\"" "${CONFIG_FILE}"
fi

if [ "${REG_DOCKER_CONFIG_ENABLED}" = "1" ];
then
    echo "Gitpod: extracting servers from the custom registry authentication"

    kubectl get secret \
        -n "${NAMESPACE}" \
        custom-registry-credentials \
        -o jsonpath="{.data.\.dockerconfigjson}" | base64 -d > /tmp/userconfig.json

    # Add the registries to the server allowlist
    yq e -i ".containerRegistry.privateBaseImageAllowList += $(jq '.auths' /tmp/userconfig.json | jq -rc 'keys')" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.privateBaseImageAllowList += \"docker.io\"" "${CONFIG_FILE}"
fi

# Output the local registry secret - this is proxy.replicated.com if user hasn't set their own
echo "${LOCAL_REGISTRY_IMAGE_PULL_SECRET}" | base64 -d > /tmp/kotsregistry.json

if [ "${REG_INCLUSTER_ENABLED}" = "0" ];
then
    echo "Gitpod: configuring external container registry"

    # Get the external-container-registry secret so we can merge the external registry and KOTS registry keys
    kubectl get secret external-container-registry \
        --namespace "${NAMESPACE}" \
        -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d > /tmp/gitpodregistry.json

    cat /tmp/kotsregistry.json /tmp/gitpodregistry.json | jq -s '.[0] * .[1]' - - > /tmp/container-registry-secret

    echo "Gitpod: create the container-registry secret"
    kubectl create secret docker-registry container-registry \
        --namespace "${NAMESPACE}" \
        --from-file=.dockerconfigjson=/tmp/container-registry-secret \
        -o yaml --dry-run=client > "${GITPOD_OBJECTS}/templates/gitpod.yaml"

    yq e -i ".containerRegistry.inCluster = false" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.external.url = \"${REG_URL}\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.external.certificate.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.external.certificate.name = \"container-registry\"" "${CONFIG_FILE}"
else
    if [ "${REG_INCLUSTER_STORAGE}" = "s3" ];
    then
        echo "Gitpod: configuring container registry S3 backend"

        yq e -i ".containerRegistry.s3storage.region = \"${REG_INCLUSTER_STORAGE_S3_REGION}\"" "${CONFIG_FILE}"
        yq e -i ".containerRegistry.s3storage.endpoint = \"${REG_INCLUSTER_STORAGE_S3_ENDPOINT}\"" "${CONFIG_FILE}"
        yq e -i ".containerRegistry.s3storage.bucket = \"${REG_INCLUSTER_STORAGE_S3_BUCKETNAME}\"" "${CONFIG_FILE}"
        yq e -i ".containerRegistry.s3storage.certificate.kind = \"secret\"" "${CONFIG_FILE}"
        yq e -i ".containerRegistry.s3storage.certificate.name = \"container-registry-s3-backend\"" "${CONFIG_FILE}"
    fi
fi

if [ "${STORE_PROVIDER}" != "incluster" ];
then
    echo "Gitpod: configuring the storage"

    yq e -i ".metadata.region = \"${STORE_REGION}\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.inCluster = false" "${CONFIG_FILE}"

    if [ "${STORE_PROVIDER}" = "azure" ];
    then
        echo "Gitpod: configuring storage for Azure"

        yq e -i ".objectStorage.azure.credentials.kind = \"secret\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.azure.credentials.name = \"storage-azure\"" "${CONFIG_FILE}"
    fi

    if [ "${STORE_PROVIDER}" = "gcp" ];
    then
        echo "Gitpod: configuring storage for GCP"

        yq e -i ".objectStorage.cloudStorage.project = \"${STORE_GCP_PROJECT}\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.cloudStorage.serviceAccount.kind = \"secret\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.cloudStorage.serviceAccount.name = \"storage-gcp\"" "${CONFIG_FILE}"
    fi

    if [ "${STORE_PROVIDER}" = "s3" ];
    then
        echo "Gitpod: configuring storage for S3"

        yq e -i ".objectStorage.s3.endpoint = \"${STORE_S3_ENDPOINT}\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.s3.bucket = \"${STORE_S3_BUCKET}\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.s3.credentials.kind = \"secret\"" "${CONFIG_FILE}"
        yq e -i ".objectStorage.s3.credentials.name = \"storage-s3\"" "${CONFIG_FILE}"
    fi
fi

if [ "${SSH_GATEWAY}" = "1" ];
then
    echo "Gitpod: Generate SSH host key"
    ssh-keygen -t rsa -q -N "" -f host.key
    kubectl create secret generic ssh-gateway-host-key --from-file=host.key -n "${NAMESPACE}" || echo "SSH Gateway Host Key secret has not been created. Does it exist already?"
    yq e -i '.sshGatewayHostKey.kind = "secret"' "${CONFIG_FILE}"
    yq e -i '.sshGatewayHostKey.name = "ssh-gateway-host-key"' "${CONFIG_FILE}"
fi

if [ "${TLS_SELF_SIGNED_ENABLED}" = "1" ];
then
    echo "Gitpod: Generating a self-signed certificate with the internal CA"
    yq e -i '.customCACert.kind = "secret"' "${CONFIG_FILE}"
    yq e -i '.customCACert.name = "ca-issuer-ca"' "${CONFIG_FILE}"
elif [ "${TLS_SELF_SIGNED_ENABLED}" = "0" ] && [ "${CERT_MANAGER_ENABLED}" = "0" ] && [ "${TLS_CUSTOM_CA_CRT_ENABLED}" = "true" ];
then
    echo "Gitpod: Setting CA to be used for certificate"
    yq e -i '.customCACert.kind = "secret"' "${CONFIG_FILE}"
    yq e -i '.customCACert.name = "ca-certificate"' "${CONFIG_FILE}"
fi

if [ "${USER_MANAGEMENT_BLOCK_ENABLED}" = "1" ];
then
    echo "Gitpod: Adding blockNewUsers to config"
    yq e -i '.blockNewUsers.enabled = true' "${CONFIG_FILE}"

    for domain in ${USER_MANAGEMENT_BLOCK_PASSLIST}
    do
        echo "Gitpod: Adding domain \"${domain}\" to blockNewUsers config"
        yq e -i ".blockNewUsers.passlist += \"${domain}\"" "${CONFIG_FILE}"
    done
fi

if [ "${ADVANCED_MODE_ENABLED}" = "1" ];
then
    echo "Gitpod: Applying advanced configuration"

    if [ "${COMPONENT_PROXY_SERVICE_SERVICETYPE}" != "" ];
    then
        # Empty string defaults to LoadBalancer. This maintains backwards compatibility with the deprecated experimental value
        echo "Gitpod: Applying Proxy service type"
        yq e -i ".components.proxy.service.serviceType = \"${COMPONENT_PROXY_SERVICE_SERVICETYPE}\"" "${CONFIG_FILE}"
    fi

    if [ -s "${CUSTOMIZATION_PATCH_FILE}" ];
    then
        CUSTOMIZATION="$(base64 "${CUSTOMIZATION_PATCH_FILE}" -w 0)"
        echo "Gitpod: Applying customization patch ${CUSTOMIZATION}"

        # Apply the customization property - if something else is set, this will be ignored
        yq e -i ".customization = $(echo "${CUSTOMIZATION}" | base64 -d | yq e -o json '.customization' - | jq -rc) // []" "${CONFIG_FILE}"
    fi
else
    echo "Gitpod: No advanced configuration applied"
fi

echo "Gitpod: Update platform telemetry value"
yq eval-all --inplace ".experimental.telemetry.data.platform = \"${DISTRIBUTION}\"" "${CONFIG_FILE}"

echo "Gitpod: Patch Gitpod config"
base64 -d "${CONFIG_PATCH_FILE}" > /tmp/patch.yaml
config_patch=$(cat /tmp/patch.yaml)
echo "Gitpod: ${CONFIG_PATCH_FILE}=${config_patch}"
yq eval-all --inplace 'select(fileIndex == 0) * select(fileIndex == 1)' "${CONFIG_FILE}" /tmp/patch.yaml

echo "Gitpod: Generate the Kubernetes objects"
config=$(cat "${CONFIG_FILE}")
echo "Gitpod: ${CONFIG_FILE}=${config}"

echo "Gitpod: render Kubernetes manifests"
/app/installer render -c "${CONFIG_FILE}" --namespace "${NAMESPACE}" --use-experimental-config >> "${GITPOD_OBJECTS}/templates/gitpod.yaml"

if [ "${REG_INCLUSTER_ENABLED}" = "1" ];
then
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
fi

if [ "${REG_DOCKER_CONFIG_ENABLED}" = "1" ];
then
    # Work out the registry secret to use
    if [ "${REG_INCLUSTER_ENABLED}" = "0" ];
    then
        export REGISTRY_SECRET_NAME="container-registry"
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

echo "Gitpod: Installer job finished - goodbye"
