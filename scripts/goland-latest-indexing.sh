#!/bin/sh

# skip indexing in regular workspaces
if [ ! "$GITPOD_HEADLESS" = "true" ] ; then exit ; fi

# resolve latest JetBrains backend version running by Gitpod
PRODUCT_CODE=GO
curl -sSL "https://data.services.jetbrains.com/products?code=$PRODUCT_CODE&fields=distributions%2Clink%2Cname%2Creleases&_=$(date +%s)000" > /tmp/jb_products.xml
JB_BACKEND_DOWNLOAD_URL=$(jq -r '.[0].releases[0].downloads.linux.link' /tmp/jb_products.xml)
echo "$JB_BACKEND_DOWNLOAD_URL"

# download JB backend
mkdir /tmp/backend-latest && cd /tmp/backend-latest || exit 1
curl -sSLo backend-latest.tar.gz "$JB_BACKEND_DOWNLOAD_URL" && tar -xf backend-latest.tar.gz --strip-components=1 && rm backend-latest.tar.gz

# config JB system config and caches aligned with runtime
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend-latest/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains-latest
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains-latest

# start JB backend in indexing mode
/tmp/backend-latest/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"
