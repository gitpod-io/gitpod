#!/bin/bash

# only run as a part of prebuild
if [ ! "$GITPOD_HEADLESS" = "true" ] ; then exit ; fi

# donwload released IntelliJ backend supported by Gitpod
INTELLIJ_DOWNLOAD_URL=$(yq read WORKSPACE.yaml 'defaultArgs.intellijDownloadUrl')
echo "$INTELLIJ_DOWNLOAD_URL"
mkdir /tmp/backend
cd /tmp/backend || exit
curl -sSLo backend.tar.gz "$INTELLIJ_DOWNLOAD_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz

# see https://github.com/gitpod-io/gitpod/blob/eaa440f09c144611d1ac3a2734dcb681617c3f5f/components/ide/jetbrains/image/leeway.Dockerfile#L12
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend/bin/idea.properties"
# see https://github.com/gitpod-io/gitpod/blob/2bd00a2afaea61b38da6df5e8d2b400641713e38/components/ide/jetbrains/image/startup.sh#L19-L23
unset JAVA_TOOL_OPTIONS
# see https://github.com/gitpod-io/gitpod/blob/2bd00a2afaea61b38da6df5e8d2b400641713e38/components/ide/jetbrains/image/startup.sh#L29
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# run indexing
/tmp/backend/bin/remote-dev-server.sh warmup /workspace/gitpod