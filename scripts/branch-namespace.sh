#!/bin/bash

source ./dev/preview/util/preview-name-from-branch.sh

currentContext=$(kubectl config current-context 2>&1) || error "cannot set kubectl namespace: no current context"
namespace="staging-$(preview-name-from-branch)"

echo "Setting kubectl namespace: $namespace"
kubectl config set-context "$currentContext" --namespace "$namespace"
