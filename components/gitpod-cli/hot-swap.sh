#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

component=${PWD##*/}

workspaceURL=${1-}
[ -z "$workspaceURL" ] && echo "Please provide a workspace URL as first argument." && exit 1
workspaceURL=$(echo "${1}" |sed -e "s/\/$//")
echo "Workspace URL: $workspaceURL"

workspaceHost=${workspaceURL//https:\/\//}
echo "Workspace Host: $workspaceHost"

workspaceID=$(echo "${workspaceHost}" | cut -d. -f1)
echo "Workspace ID: $workspaceID"

clusterHost=${workspaceHost//$workspaceID./}
echo "Cluster Host: $clusterHost"

devClusterHost=$(gp info --json |jq .cluster_host -r)
echo "Dev Cluster Host: $devClusterHost"

preview=true
if [[ $clusterHost = "$devClusterHost" ]]
then
    preview=false
fi
echo "Preview Env: $preview"

# prepare ssh config
sshConfig=$(mktemp)
echo "Host $workspaceID" > "$sshConfig"
echo "    Hostname \"$workspaceID.ssh.$clusterHost\"" >> "$sshConfig"
if [ $preview = "true" ]
then
    workspaceDesc=$(gpctl workspaces describe "$workspaceURL" -o=json)

    podName=$(echo "$workspaceDesc" | jq .runtime.pod_name -r)
    echo "Workspace Pod: $podName"

    ownerToken=$(kubectl get pod "$podName" -o=json | jq ".metadata.annotations.\"gitpod\/ownerToken\"" -r)
    echo "    User \"$workspaceID#$ownerToken\"" >> "$sshConfig"
else
    # assume SSH keys configured via .dotfiles
    echo "    User \"$workspaceID\"" >> "$sshConfig"
fi

# build
go build .
echo "$component built"

# upload
uploadDest="/.supervisor/$component"
echo "Upload Dest: $uploadDest"
ssh -F "$sshConfig" "$workspaceID" "sudo chown -R gitpod:gitpod /.supervisor && rm $uploadDest 2> /dev/null"
echo "Permissions granted"
scp -F "$sshConfig" -r "./$component" "$workspaceID":"$uploadDest"
echo "Swap complete"
