#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# This script configure remote debugging in a workspace running in a preview environment.
# It updates VM options with remote debug agent, restart the JB backend to apply them,
# and start port forwarding of the remote debug port. You can configure `Remote JVM Debug`
# run configuration using the forwarded port.
#
# ./remote-debug.sh <workspaceUrl> (<localPort>)?

workspaceUrl=${1-}
[ -z "$workspaceUrl" ] && echo "Please provide a workspace URL as first argument." && exit 1
workspaceUrl=$(echo "$workspaceUrl" |sed -e "s/\/$//")
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
sshConfig="/tmp/$workspaceId-ssh-config"
echo "Host $workspaceId" > "$sshConfig"
echo "    Hostname \"$workspaceId.ssh.$clusterHost\"" >> "$sshConfig"
echo "    User \"$workspaceId#$ownerToken\"" >> "$sshConfig"

while true
do
    # configure remote debugging
    remotePort=$(ssh -F "$sshConfig" "$workspaceId" curl http://localhost:24000/debug)
    if [ -n "$remotePort" ]; then
        localPort=${2-$remotePort}
        # forward
        echo "Forwarding Debug Port: $localPort -> $remotePort"
        ssh -F "$sshConfig" -L "$remotePort:localhost:$localPort" "$workspaceId" -N
    fi

    sleep 1
done
