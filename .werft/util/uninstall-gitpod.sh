#!/bin/bash

set -e

NAMESPACE=$1

if [[ -z ${NAMESPACE} ]]; then
   echo "One or more input params were invalid. The params we received were: ${NAMESPACE}"
   exit 1
fi

echo "Removing Gitpod in namespace ${NAMESPACE}"
kubectl get configmap gitpod-app -n "${NAMESPACE}" -o jsonpath='{.data.app\.yaml}' | kubectl delete -f -

echo "Removing Gitpod storage from ${NAMESPACE}"
kubectl -n "${NAMESPACE}" delete pvc data-mysql-0
# the installer includes the minio PVC in it's config mpap, this is a "just in case"
kubectl -n "${NAMESPACE}" delete pvc minio || true

echo "Successfully removed Gitpod from ${NAMESPACE}"