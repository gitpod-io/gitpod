#!/usr/bin/env bash
#
# This script iterates over the "dev/workload: builds" nodes and cordons them if
# their disk usage is higher than DISK_USED_THRESHOLD.
#
# The easiest way to run this script is through Werft so you don't have to worry
# about installing the appropraite service account etc. locally.
#
#   werft job run github -j .werft/platform-trigger-werft-cleanup.yaml -s .werft/platform-trigger-werft-cleanup.sh
#

sleep 1

set -Eeuo pipefail

DISK_USED_THRESHOLD=80

function cordon-node-if-almost-full {
    local node="$1"
    local zone disk_used_pct
    local slice_id="Cleanup up node $node"

    zone="$(
        kubectl get node "${node}" -o json \
        | jq -r '.metadata.labels["topology.kubernetes.io/zone"]'
    )"

    echo "Checking disk usage of /dev/sdb" | werft log slice "$slice_id"
    disk_used_pct=$(
        gcloud compute ssh \
        --project "gitpod-core-dev" \
        --zone "$zone" \
        --command="df /dev/sdb --output=pcent | tail -n1 | cut -d'%' -f1" \
        "${node}" 2>&1 \
        | tail -n1 \
        | tr -d '[:space:]'
    )
    echo "The disk is ${disk_used_pct}% full" | werft log slice "$slice_id"

    if [ "$disk_used_pct" -gt "$DISK_USED_THRESHOLD" ]; then
        echo "${disk_used_pct} is greater than ${DISK_USED_THRESHOLD}. Cordining node" | werft log slice "$slice_id"
        kubectl cordon "$node" | werft log slice "$slice_id"

        if [[ "${node}" =~ "builds-static" ]]; then
          echo "Cleaning up static node [${node}]"
          while ! is_node_empty "${node}";do
            echo "Node is not empty yet. Sleeping for 15 seconds."
            sleep 15
          done

          gcloud compute instances delete "${node}" --zone="${zone}" -q
        fi
    else
        echo "${disk_used_pct} is less than the trehold of ${DISK_USED_THRESHOLD}. Skipping node" | werft log slice "$slice_id"
    fi

    werft log slice "$slice_id" --done
}

function is_node_empty {
  local node=$1
  pods=$(kubectl -n werft get pods -o wide --field-selector spec.nodeName="${node}" 2>&1)
  if [[ "${pods}" == "No resources found in werft namespace." ]]; then
    return 0
  fi

  return 1
}

# Activate service account and install core-dev context
gcloud auth activate-service-account --key-file "/mnt/secrets/gcp-sa/service-account.json"
gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev

echo "[Process nodes|PHASE] Processing each build node"
nodes=$(kubectl get nodes -l dev/workload=builds --no-headers -o custom-columns=":metadata.name")
for node in $nodes ; do
    cordon-node-if-almost-full "$node"
done
