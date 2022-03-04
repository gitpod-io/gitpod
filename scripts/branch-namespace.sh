#!/bin/bash

branch=$(git symbolic-ref HEAD 2>&1) || error "cannot set kubectl namespace: no branch"
currentContext=$(kubectl config current-context 2>&1) || error "cannot set kubectl namespace: no current context"
namespace=staging-$(echo "$branch" | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')

echo "Setting kubectl namespace: $namespace"
kubectl config set-context "$currentContext" --namespace "$namespace"
