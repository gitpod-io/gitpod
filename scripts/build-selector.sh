#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

# get all pods running giptod, without headers, returning only the name of the node, group by node and return the name with less pods
DEPLOY_TO_NODE=$(kubectl get pods -l app=gitpod -A --no-headers  -o=custom-columns=NAME:.spec.nodeName | sort -nr | uniq -c | head -1 |  awk 'NF>1{print $NF}')

cat << EOF > "$DIR/../affinity.yaml"
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
        matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - $DEPLOY_TO_NODE
        topologyKey: kubernetes.io/hostname

components:
  workspace:
    # configure GCP registry
    pullSecret:
      secretName: gcp-sa-registry-auth
    affinity:
      nodeAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
            matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
              - $DEPLOY_TO_NODE
            topologyKey: kubernetes.io/hostname
EOF
