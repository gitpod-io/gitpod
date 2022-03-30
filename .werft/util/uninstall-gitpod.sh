#!/bin/bash

set -euo pipefail

NAMESPACE=$1
KUBECONFIG=$2

if [[ -z ${NAMESPACE} ]]; then
   echo "One or more input params were invalid. The params we received were: ${NAMESPACE}"
   exit 1
fi

echo "Removing Gitpod in namespace ${NAMESPACE}"
kubectl --kubeconfig "$KUBECONFIG" get configmap gitpod-app -n "${NAMESPACE}" -o jsonpath='{.data.app\.yaml}' | kubectl --kubeconfig "$KUBECONFIG" delete --ignore-not-found=true -f -

echo "Removing Gitpod storage from ${NAMESPACE}"
kubectl --kubeconfig "$KUBECONFIG" -n "${NAMESPACE}" --ignore-not-found=true delete pvc data-mysql-0
# the installer includes the minio PVC in it's config mpap, this is a "just in case"
kubectl --kubeconfig "$KUBECONFIG" -n "${NAMESPACE}" delete pvc minio || true

echo "Successfully removed Gitpod from ${NAMESPACE}"