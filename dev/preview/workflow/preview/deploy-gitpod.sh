#!/usr/bin/env bash
# shellcheck disable=1091

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")
ROOT="${SCRIPT_PATH}/../../../../"

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../lib/k8s-util.sh
source "$(realpath "${SCRIPT_PATH}/../lib/k8s-util.sh")"

DEV_KUBE_PATH="${DEV_KUBE_PATH:-/home/gitpod/.kube/config}"
DEV_KUBE_CONTEXT="${DEV_KUBE_CONTEXT:-dev}"

PREVIEW_NAME="${PREVIEW_NAME:-$(previewctl get name)}"
PREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBECONFIG_PATH:-/home/gitpod/.kube/config}"
PREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT:-$PREVIEW_NAME}"
PREVIEW_NAMESPACE="default"
PREVIEW_SORUCE_CERT_NAME="harvester-${PREVIEW_NAME}"

GITPOD_AGENT_SMITH_TOKEN="$(openssl rand -hex 30)"
GITPOD_AGENT_SMITH_TOKEN_HASH="$(echo -n "$GITPOD_AGENT_SMITH_TOKEN" | sha256sum - | tr -d '  -')"
GITPOD_CONTAINER_REGISTRY_URL="eu.gcr.io/gitpod-core-dev/build/";
GITPOD_IMAGE_PULL_SECRET_NAME="gcp-sa-registry-auth";
GITPOD_PROXY_SECRET_NAME="proxy-config-certificates";
GITPOD_ANALYTICS="${GITPOD_ANALYTICS:-}"
GITPOD_WITH_EE_LICENSE="${GITPOD_WITH_EE_LICENSE:-true}"
GITPOD_WORKSPACE_FEATURE_FLAGS="${GITPOD_WORKSPACE_FEATURE_FLAGS:-}"
GITPOD_WITH_DEDICATED_EMU="${GITPOD_WITH_DEDICATED_EMU:-false}"
GITPOD_WSMANAGER_MK2="${GITPOD_WSMANAGER_MK2:-false}"


if [[ "${VERSION:-}" == "" ]]; then
  if [[ ! -f  /tmp/local-dev-version ]]; then
    log_error "VERSION is not set and no fallback version exists in /tmp/local-dev-version."
    log_info "Please run leeway run dev/preview:build or set VERSION"
    exit 1
  fi
  VERSION="$(cat /tmp/local-dev-version)"
  log_info "VERSION is not set - using value from /tmp/local-dev-version which is $VERSION"
fi

INSTALLER_CONFIG_PATH="${INSTALLER_CONFIG_PATH:-$(mktemp "/tmp/XXXXXX.gitpod.config.yaml")}"
INSTALLER_RENDER_PATH="k8s.yaml" # k8s.yaml is hardcoded in post-prcess.sh - we can fix that later.

# 1. Read versions from the file system. We rely on `leeway dev/preview:deploy-dependencies` to create this file for us
# Or from the docker file if it doesn't exist
# Or just build it and get it from there
if ! test -f "/tmp/versions.yaml"; then
  ec=0
  docker run --rm "eu.gcr.io/gitpod-core-dev/build/versions:$VERSION" cat /versions.yaml > /tmp/versions.yaml || ec=$?
  if [[ ec -ne 0 ]];then
      VERSIONS_TMP_ZIP=$(mktemp "/tmp/XXXXXX.installer.tar.gz")
      leeway build components:all-docker \
                              --dont-test \
                              -Dversion="${VERSION}" \
                              -DSEGMENT_IO_TOKEN="$(kubectl --context=dev -n werft get secret self-hosted -o jsonpath='{.data.segmentIOToken}' | base64 -d)" \
                              --save "${VERSIONS_TMP_ZIP}"
      tar -xzvf "${VERSIONS_TMP_ZIP}" ./versions.yaml && sudo mv ./versions.yaml /tmp/versions.yaml
      rm "${VERSIONS_TMP_ZIP}"
  fi
fi

if ! command -v installer;then
    INSTALLER_TMP_ZIP=$(mktemp "/tmp/XXXXXX.installer.tar.gz")
    leeway build install/installer:raw-app --dont-test --save "${INSTALLER_TMP_ZIP}"
    tar -xzvf "${INSTALLER_TMP_ZIP}" ./installer && sudo mv ./installer /usr/local/bin/
    rm "${INSTALLER_TMP_ZIP}"
fi

function copyCachedCertificate {
  CERTS_NAMESPACE="certs"
  DESTINATION_CERT_NAME="$GITPOD_PROXY_SECRET_NAME"

  kubectl \
    --kubeconfig "${DEV_KUBE_PATH}" \
    --context "${DEV_KUBE_CONTEXT}" \
    get secret "${PREVIEW_SORUCE_CERT_NAME}" --namespace="${CERTS_NAMESPACE}" -o yaml \
  | yq d - 'metadata.namespace' \
  | yq d - 'metadata.uid' \
  | yq d - 'metadata.resourceVersion' \
  | yq d - 'metadata.creationTimestamp' \
  | yq d - 'metadata.ownerReferences' \
  | sed "s/${PREVIEW_SORUCE_CERT_NAME}/${DESTINATION_CERT_NAME}/g" \
  | kubectl \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      apply --namespace="${PREVIEW_NAMESPACE}" -f -
}

# Used by blobserve
function copyImagePullSecret {
  local exists

  # hasPullSecret
  exists="$(
    kubectl \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      get secret ${GITPOD_IMAGE_PULL_SECRET_NAME} \
        --namespace "${PREVIEW_NAMESPACE}" \
        --ignore-not-found
  )"

  if [[ -n "${exists}" ]]; then
    return
  fi

  imagePullAuth=$(
    printf "%s" "_json_key:$(kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" get secret ${GITPOD_IMAGE_PULL_SECRET_NAME} --namespace=keys -o yaml \
    | yq r - data['.dockerconfigjson'] \
    | base64 -d)" | base64 -w 0
  )

  cat <<EOF > "${GITPOD_IMAGE_PULL_SECRET_NAME}"
  {
    "auths": {
      "eu.gcr.io": { "auth": "${imagePullAuth}" },
      "europe-docker.pkg.dev": { "auth": "${imagePullAuth}" }
    }
  }
EOF

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    create secret docker-registry ${GITPOD_IMAGE_PULL_SECRET_NAME} \
      --namespace ${PREVIEW_NAMESPACE} \
      --from-file=.dockerconfigjson=./${GITPOD_IMAGE_PULL_SECRET_NAME}

  rm -f ${GITPOD_IMAGE_PULL_SECRET_NAME}
}

function installRookCeph {
  diff-apply "${PREVIEW_K3S_KUBE_CONTEXT}" "$ROOT/.werft/vm/manifests/rook-ceph/crds.yaml"

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    wait --for condition=established --timeout=120s crd/cephclusters.ceph.rook.io

  for file in common operator cluster-test storageclass-test snapshotclass;do
      diff-apply "${PREVIEW_K3S_KUBE_CONTEXT}" "$ROOT/.werft/vm/manifests/rook-ceph/$file.yaml"
  done
}

# Install Fluent-Bit sending logs to GCP
function installFluentBit {
    kubectl \
      --kubeconfig "${DEV_KUBE_PATH}" \
      --context "${DEV_KUBE_CONTEXT}" \
      --namespace werft \
      get secret "fluent-bit-external" -o yaml \
    | yq d - 'metadata.namespace' \
    | yq d - 'metadata.uid' \
    | yq d - 'metadata.resourceVersion' \
    | yq d - 'metadata.creationTimestamp' \
    | yq d - 'metadata.ownerReferences' \
    | sed "s/werft/${PREVIEW_NAMESPACE}/g" \
    | kubectl \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      apply -n ${PREVIEW_NAMESPACE} -f -

    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      repo add fluent https://fluent.github.io/helm-charts

    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      repo update

    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      upgrade --install fluent-bit fluent/fluent-bit --version 0.21.6 -n "${PREVIEW_NAMESPACE}" -f "$ROOT/.werft/vm/charts/fluentbit/values.yaml"
}

function installTrustManager {
    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      repo add jetstack https://charts.jetstack.io

    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      repo update

    helm3 \
      --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
      --kube-context "${PREVIEW_K3S_KUBE_CONTEXT}" \
      upgrade --install --namespace cert-manager trust-manager jetstack/trust-manager --wait
}

# ====================================
# Prerequisites
# ====================================

waitUntilAllPodsAreReady "${PREVIEW_K3S_KUBE_PATH}" "${PREVIEW_K3S_KUBE_CONTEXT}" "kube-system"
waitUntilAllPodsAreReady "${PREVIEW_K3S_KUBE_PATH}" "${PREVIEW_K3S_KUBE_CONTEXT}" "cert-manager"

# Note: These should ideally be handled by `leeway run dev/preview:create`
tries=0
while ! copyCachedCertificate; do
  if [[ ${tries} -gt 30 ]]; then
    log_error "Failed to find certificate ${PREVIEW_SORUCE_CERT_NAME}"
    exit 1
  fi
  log_info "Certificate ${PREVIEW_SORUCE_CERT_NAME} is not yet present. Sleeping 10 seconds. Attempt number ${tries}"
  sleep 10
  tries=$((tries + 1))
done

copyImagePullSecret
installRookCeph
installFluentBit
installTrustManager

# ========
# Init
# ========

installer --debug-version-file="/tmp/versions.yaml" config init --overwrite --config "$INSTALLER_CONFIG_PATH"

# =============
# Modify config
# =============

#
# getDevCustomValues
#
cat <<EOF > blockNewUsers.yaml
blockNewUsers:
  enabled: true
  passlist:
    - "gitpod.io"
EOF
yq m -i --overwrite "${INSTALLER_CONFIG_PATH}" "blockNewUsers.yaml"
rm blockNewUsers.yaml

#
# configureMetadata
#
cat <<EOF > shortname.yaml
metadata:
  shortname: "dev"
EOF
yq m -ix "${INSTALLER_CONFIG_PATH}" shortname.yaml
rm shortname.yaml

#
# configureContainerRegistry
#
yq w -i "${INSTALLER_CONFIG_PATH}" certificate.name "${GITPOD_PROXY_SECRET_NAME}"
yq w -i "${INSTALLER_CONFIG_PATH}" containerRegistry.inCluster "false"
yq w -i "${INSTALLER_CONFIG_PATH}" containerRegistry.external.url "${GITPOD_CONTAINER_REGISTRY_URL}"
yq w -i "${INSTALLER_CONFIG_PATH}" containerRegistry.external.certificate.kind secret
yq w -i "${INSTALLER_CONFIG_PATH}" containerRegistry.external.certificate.name "${GITPOD_IMAGE_PULL_SECRET_NAME}"

#
# configureDomain
#
DOMAIN="${PREVIEW_NAME}.preview.gitpod-dev.com"
yq w -i "${INSTALLER_CONFIG_PATH}" domain "${DOMAIN}"

#
# configureWorkspaces
#
CONTAINERD_RUNTIME_DIR="/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io"
yq w -i "${INSTALLER_CONFIG_PATH}" workspace.runtime.containerdRuntimeDir ${CONTAINERD_RUNTIME_DIR}
yq w -i "${INSTALLER_CONFIG_PATH}" workspace.resources.requests.cpu "100m"
yq w -i "${INSTALLER_CONFIG_PATH}" workspace.resources.requests.memory "256Mi"

# create two workspace classes (default and small) in server-config configmap
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[+].id "default"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].category "GENERAL PURPOSE"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].displayName "Default"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].description "Default workspace class (30GB disk)"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].powerups "1"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].isDefault "true"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].credits.perMinute "0.3333333333"

yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[+].id "small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].category "GENERAL PURPOSE"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].displayName "Small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].description "Small workspace class (20GB disk)"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].powerups "2"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].credits.perMinute "0.1666666667"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].marker.moreResources "true"

# create two workspace classes (default and small) in ws-manager configmap
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].name "default"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].resources.requests.cpu "100m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].resources.requests.memory "128Mi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].prebuildPVC.size "30Gi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].prebuildPVC.storageClass "rook-ceph-block"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].prebuildPVC.snapshotClass "csi-rbdplugin-snapclass"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.size "30Gi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.storageClass "rook-ceph-block"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.snapshotClass "csi-rbdplugin-snapclass"

yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].name "small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].resources.requests.cpu "100m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].resources.requests.memory "128Mi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].prebuildPVC.size "20Gi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].prebuildPVC.storageClass "rook-ceph-block"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].prebuildPVC.snapshotClass "csi-rbdplugin-snapclass"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].pvc.size "20Gi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].pvc.storageClass "rook-ceph-block"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].pvc.snapshotClass "csi-rbdplugin-snapclass"

#
# configureObjectStorage
#
yq w -i "${INSTALLER_CONFIG_PATH}" objectStorage.resources.requests.memory "256Mi"

#
# configureIDE
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.ide.resolveLatest "false"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.ide.ideMetrics.enabledErrorReporting "true"

#
# configureObservability
#
TRACING_ENDPOINT="http://otel-collector.monitoring-satellite.svc.cluster.local:14268/api/traces"
yq w -i "${INSTALLER_CONFIG_PATH}" observability.tracing.endpoint "${TRACING_ENDPOINT}"

#
# configureAuthProviders
#

if [[ "${GITPOD_WITH_DEDICATED_EMU}" != "true" ]]
then
  for row in $(kubectl --kubeconfig "$DEV_KUBE_PATH" --context "${DEV_KUBE_CONTEXT}" get secret preview-envs-authproviders-harvester --namespace=keys -o jsonpath="{.data.authProviders}" \
  | base64 -d -w 0 \
  | yq r - authProviders -j \
  | jq -r 'to_entries | .[] | @base64'); do
      key=$(echo "${row}" | base64 -d | jq -r '.key')
      providerId=$(echo "$row" | base64 -d | jq -r '.value.id | ascii_downcase')
      data=$(echo "$row" | base64 -d | yq r - value --prettyPrint)
      yq w -i "${INSTALLER_CONFIG_PATH}" authProviders["$key"].kind "secret"
      yq w -i "${INSTALLER_CONFIG_PATH}" authProviders["$key"].name "$providerId"

      kubectl create secret generic "$providerId" \
          --namespace "${PREVIEW_NAMESPACE}" \
          --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
          --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
          --from-literal=provider="$data" \
          --dry-run=client -o yaml | \
          kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" replace --force -f -
  done
fi

#
# configure dedicated emulation
#

if [[ "${GITPOD_WITH_DEDICATED_EMU}" == "true" ]]
then
  # Suppress the Self-Hosted setup modal
  yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.server.showSetupModal "false"
fi

#
# configureStripeAPIKeys
#
kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" -n werft get secret stripe-api-keys -o yaml > stripe-api-keys.secret.yaml
yq w -i stripe-api-keys.secret.yaml metadata.namespace "default"
yq d -i stripe-api-keys.secret.yaml metadata.creationTimestamp
yq d -i stripe-api-keys.secret.yaml metadata.uid
yq d -i stripe-api-keys.secret.yaml metadata.resourceVersion
diff-apply "${PREVIEW_K3S_KUBE_CONTEXT}" stripe-api-keys.secret.yaml
rm -f stripe-api-keys.secret.yaml

#
# configureSSHGateway
#
kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" --namespace keys get secret host-key -o yaml \
| yq w - metadata.namespace ${PREVIEW_NAMESPACE} \
| yq d - metadata.uid \
| yq d - metadata.resourceVersion \
| yq d - metadata.creationTimestamp > host-key.yaml
diff-apply "${PREVIEW_K3S_KUBE_CONTEXT}" host-key.yaml
rm -f host-key.yaml

yq w -i "${INSTALLER_CONFIG_PATH}" sshGatewayHostKey.kind "secret"
yq w -i "${INSTALLER_CONFIG_PATH}" sshGatewayHostKey.name "host-key"

#
# configureUsage
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.enabled "true"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.schedule "1m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.billInstancesAfter "2022-08-11T08:05:32.499Z"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.forUsers "500"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.forTeams "0"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.minForUsersOnStripe "1000"

# Configure Price IDs
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.individualUsagePriceIds['EUR'] "price_1LmYVxGadRXm50o3AiLq0Qmo"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.individualUsagePriceIds['USD'] "price_1LmYWRGadRXm50o3Ym8PLqnG"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.teamUsagePriceIds['EUR'] "price_1LmYVxGadRXm50o3AiLq0Qmo"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.teamUsagePriceIds['USD'] "price_1LmYWRGadRXm50o3Ym8PLqnG"

#
# configureConfigCat
#
# This key is not a secret, it is a unique identifier of our ConfigCat application
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.configcatKey "WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.proxy.configcat.baseUrl "https://cdn-global.configcat.com"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.proxy.configcat.pollInterval "1m"

#
# configure JWT signign key
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.publicApi.oidcClientJWTSigningKeySecretName "oidc-client-jwt-signing-key"

#
# configure Personal Access Token signign key
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.publicApi.personalAccessTokenSigningKeySecretName "personal-access-token-signing-key"

#
# configure workspace template and workspace class template
#
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers[+].name' "workspace"
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_PREVENT_METADATA_ACCESS"
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_PREVENT_METADATA_ACCESS).value' "true"

yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers[+].name' "workspace"
yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_PREVENT_METADATA_ACCESS"
yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_PREVENT_METADATA_ACCESS).value' "true"

yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers[+].name' "workspace"
yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_PREVENT_METADATA_ACCESS"
yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_PREVENT_METADATA_ACCESS).value' "true"

#
# includeAnalytics
#
if [[ "${GITPOD_ANALYTICS}" == "segment" ]]; then
  GITPOD_ANALYTICS_SEGMENT_TOKEN="$(readWerftSecret "segment-staging-write-key" "token")"
  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.writer segment
  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.segmentKey "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_WRITER"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_WRITER).value' "segment"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_SEGMENT_KEY"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_SEGMENT_KEY).value' "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"

  # add to default workspace class
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_WRITER"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_WRITER).value' "segment"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_SEGMENT_KEY"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.default.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_SEGMENT_KEY).value' "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"

  # add to small workspace class
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_WRITER"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_WRITER).value' "segment"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_SEGMENT_KEY"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'experimental.workspace.classes.small.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_SEGMENT_KEY).value' "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"
else
  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.writer ""
fi

#
# wsManagerMk2
#
if [[ "${GITPOD_WSMANAGER_MK2}" == "true" ]]; then
  yq w -i "${INSTALLER_CONFIG_PATH}" "experimental.workspace.useWsmanagerMk2" "true"
fi


#
# chargebee
#
yq w -i "${INSTALLER_CONFIG_PATH}" "experimental.webapp.server.chargebeeSecret" "chargebee-config"

#
# Stripe
#
yq w -i "${INSTALLER_CONFIG_PATH}" "experimental.webapp.server.stripeSecret" "stripe-api-keys"
yq w -i "${INSTALLER_CONFIG_PATH}" "experimental.webapp.server.stripeConfig" "stripe-config"

#
# Enable SpiceDB on all preview envs
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.spicedb.enabled "true"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.spicedb.secretRef "spicedb-secret"

#
# Configure spicedb secret
#
kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" -n werft get secret spicedb-secret -o yaml > spicedb-secret.yaml
yq w -i spicedb-secret.yaml metadata.namespace "default"
yq d -i spicedb-secret.yaml metadata.creationTimestamp
yq d -i spicedb-secret.yaml metadata.uid
yq d -i spicedb-secret.yaml metadata.resourceVersion
diff-apply "${PREVIEW_K3S_KUBE_CONTEXT}" spicedb-secret.yaml
rm -f spicedb-secret.yaml

#
# Enable "Frontend Dev" on all preview envs
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.proxy.frontendDevEnabled "true"


log_success "Generated config at $INSTALLER_CONFIG_PATH"

# ========
# Validate
# ========

log_info "Validating config"
installer --debug-version-file="/tmp/versions.yaml" validate config --config "$INSTALLER_CONFIG_PATH"

# ========
# Render
# ========

log_info "Rendering manifests"
installer --debug-version-file="/tmp/versions.yaml" render \
  --use-experimental-config \
  --namespace "${PREVIEW_NAMESPACE}" \
  --config "${INSTALLER_CONFIG_PATH}" > "${INSTALLER_RENDER_PATH}"

# ===============
# Post-processing
# ===============

log_info "Post-processing"

#
# configureLicense
#
if [[ "${GITPOD_WITH_EE_LICENSE}" == "true" ]]
then
  readWerftSecret "gpsh-harvester-license" "license" > /tmp/license
else
  touch /tmp/license
fi

#
# configureWorkspaceFeatureFlags
#
touch /tmp/defaultFeatureFlags
for feature in ${GITPOD_WORKSPACE_FEATURE_FLAGS}; do
  # post-process.sh looks for /tmp/defaultFeatureFlags
  # each "flag" string gets added to the configmap
  # also watches aout for /tmp/payment
  echo "$feature" >> /tmp/defaultFeatureFlags
done

#
# configurePayment
#
SERVICE_WAITER_VERSION="$(yq r /tmp/versions.yaml 'components.serviceWaiter.version')"
PAYMENT_ENDPOINT_VERSION="$(yq r /tmp/versions.yaml 'components.paymentEndpoint.version')"

# 2. render chargebee-config and payment-endpoint
rm -f /tmp/payment
for manifest in "$ROOT"/.werft/jobs/build/payment/*.yaml; do
  sed "s/\${NAMESPACE}/${PREVIEW_NAMESPACE}/g" "$manifest" \
  | sed "s/\${PAYMENT_ENDPOINT_VERSION}/${PAYMENT_ENDPOINT_VERSION}/g" \
  | sed "s/\${SERVICE_WAITER_VERSION}/${SERVICE_WAITER_VERSION}/g" \
  >> /tmp/payment
  echo "---" >> /tmp/payment
done

#
# configurePublicAPI
#

rm -f /tmp/public-api
for manifest in "$ROOT"/.werft/jobs/build/public-api/*.yaml; do
  cat "$manifest" >> /tmp/public-api
  echo "---" >> /tmp/public-api
done

#
# Run post-process script
#

WITH_VM=true "$ROOT/.werft/jobs/build/installer/post-process.sh" "${PREVIEW_NAME}" "${GITPOD_AGENT_SMITH_TOKEN}"

#
# Cleanup from post-processing
#
rm -f /tmp/payment
rm -f /tmp/defaultFeatureFlags
rm -f /tmp/license
rm -f /tmp/public-api

# ===============
# Install
# ===============

log_info "Applying manifests (installing)"
# avoid random werft namespace errors
kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" create namespace werft || true
kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" delete -n "${PREVIEW_NAMESPACE}" job migrations || true
# export the function so we can use it in xargs
export -f diff-apply
mkdir temp-installer || true
pushd temp-installer
# this will split the big yaml produced by the installer, so we can diff individual parts of it and run them in parallel
yq4 -s '.kind + "_" + (.metadata.namespace // "") + "_" + .metadata.name' "../${INSTALLER_RENDER_PATH}"
rm .yml || true # this one is a leftover from the split
# shellcheck disable=SC2038
find . | xargs -n 1 -I {} -P 5 bash -c "diff-apply ${PREVIEW_K3S_KUBE_CONTEXT} {}"
log_info "Applied all"
popd
rm -rf temp-installer
rm -f "${INSTALLER_RENDER_PATH}"

# =========================
# Wait for objects to be ready
# =========================
for item in deployment.apps/blobserve deployment.apps/content-service deployment.apps/dashboard deployment.apps/ide-metrics deployment.apps/ide-proxy deployment.apps/ide-service deployment.apps/image-builder-mk3 deployment.apps/minio deployment.apps/node-labeler deployment.apps/payment-endpoint deployment.apps/proxy deployment.apps/public-api-server deployment.apps/redis deployment.apps/server deployment.apps/spicedb deployment.apps/usage deployment.apps/ws-manager deployment.apps/ws-manager-bridge deployment.apps/ws-proxy statefulset.apps/messagebus statefulset.apps/mysql statefulset.apps/openvsx-proxy daemonset.apps/agent-smith daemonset.apps/fluent-bit daemonset.apps/registry-facade daemonset.apps/ws-daemon; do
  kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" rollout status "${item}" --namespace="${PREVIEW_NAMESPACE}"
done

# =====================
# Add agent smith token
# =====================
leeway run components:add-smith-token \
  -DTOKEN="${GITPOD_AGENT_SMITH_TOKEN_HASH}" \
  -DPREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBE_PATH}" \
  -DPREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT}" \
  -DPREVIEW_NAMESPACE="${PREVIEW_NAMESPACE}"

# Add experimental node label if ws-manager-mk2 is enabled.
# Remove once mk2 workspaces no longer run on experimental nodes.
kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" --namespace="${PREVIEW_NAMESPACE}" label nodes "${PREVIEW_K3S_KUBE_CONTEXT}" gitpod.io/experimental="true" --overwrite

log_success "Installation is happy: https://${DOMAIN}/workspaces"
