#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")
ROOT="${SCRIPT_PATH}/../../../../"

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"
# shellcheck source=../../util/preview-name-from-branch.sh
source "$(realpath "${SCRIPT_PATH}/../../util/preview-name-from-branch.sh")"

DEV_KUBE_PATH="${DEV_KUBE_PATH:-/home/gitpod/.kube/config}"
DEV_KUBE_CONTEXT="${DEV_KUBE_CONTEXT:-dev}"

PREVIEW_NAME="${PREVIEW_NAME:-$(preview-name-from-branch)}"
PREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBECONFIG_PATH:-/home/gitpod/.kube/config}"
PREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT:-$PREVIEW_NAME}"
PREVIEW_NAMESPACE="default"

GITPOD_AGENT_SMITH_TOKEN="$(openssl rand -hex 30)"
GITPOD_AGENT_SMITH_TOKEN_HASH="$(echo -n "$GITPOD_AGENT_SMITH_TOKEN" | sha256sum - | tr -d '  -')"
GITPOD_CONTAINER_REGISTRY_URL="eu.gcr.io/gitpod-core-dev/build/";
GITPOD_IMAGE_PULL_SECRET_NAME="gcp-sa-registry-auth";
GITPOD_PROXY_SECRET_NAME="proxy-config-certificates";
GITPOD_ANALYTICS="${GITPOD_ANALYTICS:-}"
GITPOD_WITH_EE_LICENSE="${GITPOD_WITH_EE_LICENSE:-true}"
GITPOD_WORKSPACE_FEATURE_FLAGS="${GITPOD_WORKSPACE_FEATURE_FLAGS:-}"
GITPOD_WITH_SLOW_DATABASE="${GITPOD_WITH_SLOW_DATABASE:-false}"

VERSION="${VERSION:-${PREVIEW_NAME}-dev}"
INSTALLER_BINARY_PATH="$(mktemp "/tmp/XXXXXX.installer")}"
INSTALLER_CONFIG_PATH="${INSTALLER_CONFIG_PATH:-$(mktemp "/tmp/XXXXXX.gitpod.config.yaml")}"
INSTALLER_RENDER_PATH="k8s.yaml" # k8s.yaml is hardcoded in post-prcess.sh - we can fix that later.

function installer {
  if [[ ! -f ${INSTALLER_BINARY_PATH} ]]; then
    docker run \
      --entrypoint sh \
      --rm \
      --pull=always \
      "eu.gcr.io/gitpod-core-dev/build/installer:${VERSION}" -c "cat /app/installer" \
    > "${INSTALLER_BINARY_PATH}"
    chmod +x "${INSTALLER_BINARY_PATH}"
  fi
  "${INSTALLER_BINARY_PATH}" "$@"
}

function copyCachedCertificate {
  CERTS_NAMESPACE="certs"
  SORUCE_CERT_NAME="harvester-${PREVIEW_NAME}"
  DESTINATION_CERT_NAME="$GITPOD_PROXY_SECRET_NAME"

  kubectl \
    --kubeconfig "${DEV_KUBE_PATH}" \
    --context "${DEV_KUBE_CONTEXT}" \
    get secret "${SORUCE_CERT_NAME}" --namespace="${CERTS_NAMESPACE}" -o yaml \
  | yq d - 'metadata.namespace' \
  | yq d - 'metadata.uid' \
  | yq d - 'metadata.resourceVersion' \
  | yq d - 'metadata.creationTimestamp' \
  | yq d - 'metadata.ownerReferences' \
  | sed "s/${SORUCE_CERT_NAME}/${DESTINATION_CERT_NAME}/g" \
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

function waitUntilAllPodsAreReady {
  local namespace
  local exitCode
  namespace="$1"

  echo "Waiting until all pods in namespace ${namespace} are Running/Succeeded/Completed."
  ATTEMPTS=0
  SUCCESSFUL="false"
  while [ ${ATTEMPTS} -lt 200 ]
  do
    ATTEMPTS=$((ATTEMPTS+1))
    set +e
    pods=$(
      kubectl \
        --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
        --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
        get pods -n "${namespace}" \
          -l 'component!=workspace' \
          -o=jsonpath='{range .items[*]}{@.metadata.name}:{@.metadata.ownerReferences[0].kind}:{@.status.phase} {end}'
    )
    exitCode=$?
    set -e
    if [[ $exitCode -gt 0 ]]; then
      echo "Failed to get pods in namespace. Exit code $exitCode"
      echo "Sleeping 3 seconds"
      sleep 3
      continue
    fi

    if [[ -z "${pods}" ]]; then
      echo "The namespace is empty or does not exist."
      echo "Sleeping 3 seconds"
      sleep 3
      continue
    fi

    unreadyPods=""
    for  pod in $pods; do
      owner=$(echo "$pod" | cut -d ":" -f 2)
      phase=$(echo "$pod" | cut -d ":" -f 3)
      if [[ $owner == "Job" && $phase != "Succeeded" ]]; then
        unreadyPods="$pod $unreadyPods"
      fi
      if [[ $owner != "Job" && $phase != "Running" ]]; then
        unreadyPods="$pod $unreadyPods"
      fi
    done

    if [[ -z "${unreadyPods}" ]]; then
      echo "All pods are Running/Succeeded/Completed!"
      SUCCESSFUL="true"
      break
    fi

    echo "Uneady pods: $unreadyPods"
    echo "Sleeping 10 seconds before checking again"
    sleep 10
  done

  if [[ "${SUCCESSFUL}" == "true" ]]; then
    return 0
  else
    echo "Not all pods in namespace ${namespace} transitioned to 'Running' or 'Succeeded/Completed' during the expected time."
    return 1
  fi
}

function installRookCeph {
  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f "$ROOT/.werft/vm/manifests/rook-ceph/crds.yaml" --server-side --force-conflicts

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    wait --for condition=established --timeout=120s crd/cephclusters.ceph.rook.io

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f "$ROOT/.werft/vm/manifests/rook-ceph/common.yaml" -f "$ROOT/.werft/vm/manifests/rook-ceph/operator.yaml"

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f "$ROOT/.werft/vm/manifests/rook-ceph/cluster-test.yaml"

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f "$ROOT/.werft/vm/manifests/rook-ceph/storageclass-test.yaml"

  kubectl \
    --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" \
    --context "${PREVIEW_K3S_KUBE_CONTEXT}" \
    apply -f "$ROOT/.werft/vm/manifests/rook-ceph/snapshotclass.yaml"
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
      upgrade --install fluent-bit fluent/fluent-bit -n "${PREVIEW_NAMESPACE}" -f "$ROOT/.werft/vm/charts/fluentbit/values.yaml"
}

# ====================================
# Prerequisites
# ====================================

waitUntilAllPodsAreReady "kube-system"
waitUntilAllPodsAreReady "cert-manager"

# Note: These should ideally be handled by `leeway run dev/preview:create`
copyCachedCertificate
copyImagePullSecret
installRookCeph
installFluentBit

# ========
# Init
# ========

installer config init --overwrite --config "$INSTALLER_CONFIG_PATH"

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
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[0].deprecated "false"

yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[+].id "small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].category "GENERAL PURPOSE"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].displayName "Small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].description "Small workspace class (20GB disk)"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].powerups "2"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].isDefault "false"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].deprecated "false"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.workspaceClasses[1].marker.moreResources "true"

# create two workspace classes (default and small) in ws-manager configmap
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].name "default"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].resources.requests.cpu "100m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].resources.requests.memory "128Mi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.size "30Gi"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.storageClass "rook-ceph-block"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["default"].pvc.snapshotClass "csi-rbdplugin-snapclass"

yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].name "small"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].resources.requests.cpu "100m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.workspace.classes["small"].resources.requests.memory "128Mi"
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

#
# configureStripeAPIKeys
#
kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" -n werft get secret stripe-api-keys -o yaml > stripe-api-keys.secret.yaml
yq w -i stripe-api-keys.secret.yaml metadata.namespace "default"
yq d -i stripe-api-keys.secret.yaml metadata.creationTimestamp
yq d -i stripe-api-keys.secret.yaml metadata.uid
yq d -i stripe-api-keys.secret.yaml metadata.resourceVersion
kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" apply -f stripe-api-keys.secret.yaml
rm -f stripe-api-keys.secret.yaml

#
# configureSSHGateway
#
kubectl --kubeconfig "${DEV_KUBE_PATH}" --context "${DEV_KUBE_CONTEXT}" --namespace keys get secret host-key -o yaml \
| yq w - metadata.namespace ${PREVIEW_NAMESPACE} \
| yq d - metadata.uid \
| yq d - metadata.resourceVersion \
| yq d - metadata.creationTimestamp \
| kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" apply -f -

yq w -i "${INSTALLER_CONFIG_PATH}" sshGatewayHostKey.kind "secret"
yq w -i "${INSTALLER_CONFIG_PATH}" sshGatewayHostKey.name "host-key"

#
# configurePublicAPIServer
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.publicApi.enabled true

#
# configureUsage
#
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.enabled "true"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.schedule "1m"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.billInstancesAfter "2022-08-11T08:05:32.499Z"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.forUsers "500"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.forTeams "0"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.defaultSpendingLimit.minForUsersOnStripe "1000"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.creditsPerMinuteByWorkspaceClass['default'] "0.1666666667"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.usage.creditsPerMinuteByWorkspaceClass['gitpodio-internal-xl'] "0.3333333333"

# Configure Price IDs
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.individualUsagePriceIds['EUR'] "price_1LmYVxGadRXm50o3AiLq0Qmo"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.individualUsagePriceIds['USD'] "price_1LmYWRGadRXm50o3Ym8PLqnG"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.teamUsagePriceIds['EUR'] "price_1LiId7GadRXm50o3OayAS2y4"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.stripe.teamUsagePriceIds['USD'] "price_1LiIdbGadRXm50o3ylg5S44r"

#
# configureConfigCat
#
# This key is not a secret, it is a unique identifier of our ConfigCat application
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.configcatKey "WBLaCPtkjkqKHlHedziE9g/LEAOCNkbuUKiqUZAcVg7dw"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.proxy.configcat.baseUrl "https://cdn-global.configcat.com"
yq w -i "${INSTALLER_CONFIG_PATH}" experimental.webapp.proxy.configcat.pollInterval "1m"

#
# configureDefaultTemplate
#
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers[+].name' "workspace"
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_PREVENT_METADATA_ACCESS"
yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_PREVENT_METADATA_ACCESS).value' "true"

#
# configureSlowDatabase
#
if [[ "${GITPOD_WITH_SLOW_DATABASE}" == "true" ]]
then
  yq w -i "${INSTALLER_CONFIG_PATH}" "experimental.webapp.slowDatabase" "true"
fi

#
# includeAnalytics
#
if [[ "${GITPOD_ANALYTICS}" == "segment" ]]; then

  GITPOD_ANALYTICS_SEGMENT_TOKEN=$(kubectl \
    --kubeconfig "${DEV_KUBE_PATH}" \
    --context "${DEV_KUBE_CONTEXT}" \
    --namespace werft \
    get secret "segment-staging-write-key" -o jsonpath='{.data.token}' \
  | base64 -d)

  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.writer segment
  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.segmentKey "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_WRITER"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_WRITER).value' "segment"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env[+].name' "GITPOD_ANALYTICS_SEGMENT_KEY"
  yq w -i "${INSTALLER_CONFIG_PATH}" 'workspace.templates.default.spec.containers.(name==workspace).env.(name==GITPOD_ANALYTICS_SEGMENT_KEY).value' "${GITPOD_ANALYTICS_SEGMENT_TOKEN}"
else
  yq w -i "${INSTALLER_CONFIG_PATH}" analytics.writer ""
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

log_success "Generated config at $INSTALLER_CONFIG_PATH"

# ========
# Validate
# ========

log_info "Validating config"
installer validate config --config "$INSTALLER_CONFIG_PATH"

# ========
# Render
# ========

log_info "Rendering manifests"
installer render \
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
  kubectl \
    --kubeconfig "${DEV_KUBE_PATH}" \
    --context "${DEV_KUBE_CONTEXT}" \
    --namespace werft \
    get secret "gpsh-harvester-license" -o jsonpath='{.data.license}' \
  | base64 -d \
  > /tmp/license
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

# 1. Read versions from docker image
docker run --rm "eu.gcr.io/gitpod-core-dev/build/versions:$VERSION" cat /versions.yaml > /tmp/versions.yaml
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
# Run post-process script
#

WITH_VM=true "$ROOT/.werft/jobs/build/installer/post-process.sh" "${PREVIEW_NAME}" "${GITPOD_AGENT_SMITH_TOKEN}"

#
# Cleanup from post-processing
#
rm -f /tmp/payment
rm -f /tmp/defaultFeatureFlags
rm -f /tmp/license

# ===============
# Install
# ===============

log_info "Applying manifests (installing)"

kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" delete -n "${PREVIEW_NAMESPACE}" job migrations || true
kubectl --kubeconfig "${PREVIEW_K3S_KUBE_PATH}" --context "${PREVIEW_K3S_KUBE_CONTEXT}" apply -f "${INSTALLER_RENDER_PATH}"
rm -f "${INSTALLER_RENDER_PATH}"

# =========================
# Wait for pods to be ready
# =========================
waitUntilAllPodsAreReady "$PREVIEW_NAMESPACE"

# =====================
# Add agent smith token
# =====================
leeway run components:add-smith-token \
  -DTOKEN="${GITPOD_AGENT_SMITH_TOKEN_HASH}" \
  -DPREVIEW_K3S_KUBE_PATH="${PREVIEW_K3S_KUBE_PATH}" \
  -DPREVIEW_K3S_KUBE_CONTEXT="${PREVIEW_K3S_KUBE_CONTEXT}" \
  -DPREVIEW_NAMESPACE="${PREVIEW_NAMESPACE}"

log_success "Installation is happy: https://${DOMAIN}/workspaces"
