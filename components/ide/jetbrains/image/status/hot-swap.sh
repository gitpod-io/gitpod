#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# This script swaps the backend startup endpoint with a built one
# in a workspace and restarts the JB backend.

component=${PWD##*/}
workspaceUrl=$(echo "${1}" |sed -e "s/\/$//")
echo "URL: $workspaceUrl"

workspaceDesc=$(gpctl workspaces describe "$workspaceUrl" -o=json)

podName=$(echo "$workspaceDesc" | jq .runtime.pod_name -r)
echo "Pod: $podName"

workspaceId=$(echo "$workspaceDesc" | jq .metadata.meta_id -r)
echo "ID: $workspaceId"

clusterHost=$(kubectl exec -it "$podName" -- printenv GITPOD_WORKSPACE_CLUSTER_HOST |sed -e "s/\s//g")
echo "Cluster Host: $clusterHost"

# prepare ssh
ownerToken=$(kubectl get pod "$podName" -o=json | jq ".metadata.annotations.\"gitpod\/ownerToken\"" -r)
sshConfig="./ssh-config"
echo "Host $workspaceId" > "$sshConfig"
echo "    Hostname \"$workspaceId.ssh.$clusterHost\"" >> "$sshConfig"
echo "    User \"$workspaceId#$ownerToken\"" >> "$sshConfig"

# upload
uploadDest="/ide-desktop/$component"
echo "Upload Dest: $uploadDest"
scp -F "$sshConfig" -r "./components-ide-jetbrains-image-status--app/status" "$workspaceId":"$uploadDest"

#link
link="/ide-desktop/status"
ssh -F "$sshConfig" "$workspaceId" ln -sf "$uploadDest" "$link"
echo "Link: $link -> $uploadDest"

# restart
ssh -F "$sshConfig" "$workspaceId" curl http://localhost:24000/restart && true
echo "Restarted: please reconenct to JB backend to try new changes."
