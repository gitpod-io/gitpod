#!/bin/sh

# skip indexing in regular workspaces
if [ ! "$GITPOD_HEADLESS" = "true" ] ; then exit ; fi

# resolve JetBrains backend version running by Gitpod
curl https://raw.githubusercontent.com/gitpod-io/gitpod/main/WORKSPACE.yaml > /tmp/gitpod_workspace.yaml
sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
sudo chmod a+x /usr/local/bin/yq
JB_BACKEND_DOWNLOAD_URL=$(yq eval '.defaultArgs.golandDownloadUrl' /tmp/gitpod_workspace.yaml)
echo "$JB_BACKEND_DOWNLOAD_URL"

# download JB backend
mkdir /tmp/backend && cd /tmp/backend || exit 1
curl -sSLo backend.tar.gz "$JB_BACKEND_DOWNLOAD_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz

# config JB system config and caches aligned with runtime
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# start JB backend in indexing mode
/tmp/backend/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"
