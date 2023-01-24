#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

# This script builds the backend plugin, replaces the backend plugin on a running workspace and restarts the JB backend.

workspaceURL=${1-}
[ -z "$workspaceURL" ] && echo "Please provide a workspace URL as first argument." && exit 1
workspaceURL=$(echo "$workspaceURL" |sed -e "s/\/$//")
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

product=${2-intellij}
qualifier=${3-latest}

# prepare ssh config
sshConfig=$(mktemp)
echo "Host $workspaceID" > "$sshConfig"
echo "    Hostname \"$workspaceID.ssh.$clusterHost\"" >> "$sshConfig"
if [ $preview = "true" ]
then
    workspaceDesc=$(gpctl workspaces describe "$workspaceURL" -o=json)

    podName=$(echo "$workspaceDesc" | jq .runtime.pod_name -r)
    echo "Workspace Pod: $podName"

    qualifier=$(kubectl exec -it "$podName" -- printenv JETBRAINS_BACKEND_QUALIFIER |sed -e "s/\s//g")

    ownerToken=$(kubectl get pod "$podName" -o=json | jq ".metadata.annotations.\"gitpod\/ownerToken\"" -r)
    echo "    User \"$workspaceID#$ownerToken\"" >> "$sshConfig"
else
    # assume SSH keys configured via .dotfiles
    echo "    User \"$workspaceID\"" >> "$sshConfig"
fi

echo "Product: $product"
echo "Version Qualifier: $qualifier"

# prepare build
component="gitpod-remote-$qualifier-$(date +%F_T"%H-%M-%S")"
tarDir="/tmp/hot-swap/$component"
mkdir -p "$tarDir"
echo "Build Dir: $tarDir"

# build
tarFile="$tarDir/build.tar.gz"
leeway build -DnoVerifyJBPlugin=true .:"plugin-$qualifier" --save "$tarFile"
tar -xf "$tarFile" -C "$tarDir"

# upload
uploadDest="/ide-desktop-plugins/$component"
echo "Upload Dest: $uploadDest"
scp -F "$sshConfig" -r "$tarDir/build/gitpod-remote" "$workspaceID":"$uploadDest"

# link
link="/ide-desktop/$product/backend/plugins/gitpod-remote"
if [ "$qualifier" = "latest" ]
then
    link="/ide-desktop/$product-$qualifier/backend/plugins/gitpod-remote"
fi
ssh -F "$sshConfig" "$workspaceID" ln -sfn "$uploadDest" "$link"
echo "Link: $link -> $uploadDest"

# restart
ssh -F "$sshConfig" "$workspaceID" curl http://localhost:24000/restart
echo "Restarted: please reconnect to JB backend to try new changes."

# clean up
rm -rf "$tarDir"
