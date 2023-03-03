#!/usr/bin/env bash

# this script is meant to be sourced

function waitUntilAllPodsAreReady {
  local namespace
  local exitCode
  local kube_path
  local kube_context

  kube_path="$1"
  kube_context="$2"
  namespace="$3"

  echo "Waiting until all pods in namespace ${namespace} are Running/Succeeded/Completed."
  local attemps=0
  local successful=false
  while [ ${attemps} -lt 200 ]
  do
    attemps=$((attemps+1))
    set +e
    pods=$(
      kubectl \
        --kubeconfig "${kube_path}" \
        --context "${kube_context}" \
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
      successful="true"
      break
    fi

    echo "Uneady pods: $unreadyPods"
    echo "Sleeping 10 seconds before checking again"
    sleep 10
  done

  if [[ "${successful}" == "true" ]]; then
    return 0
  else
    echo "Not all pods in namespace ${namespace} transitioned to 'Running' or 'Succeeded/Completed' during the expected time."
    return 1
  fi
}

function readWerftSecret {
    local name
    local key
    name="$1"
    key="$2"
    kubectl \
        --kubeconfig "${DEV_KUBE_PATH}" \
        --context "${DEV_KUBE_CONTEXT}" \
        --namespace werft \
    get secret "${name}" -o jsonpath="{.data.${key}}" \
  | base64 -d
}
