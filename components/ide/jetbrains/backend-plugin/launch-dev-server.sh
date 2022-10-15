#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -e
set -o pipefail

# Default Options
DEBUG_PORT=44444
JB_QUALIFIER="latest"
TEST_REPO=https://github.com/gitpod-io/spring-petclinic
RUN_FROM="release"

# Parsing Custom Options
while getopts "p:r:su" OPTION
do
   case $OPTION in
       s) JB_QUALIFIER="stable" ;;
       r) TEST_REPO=$OPTARG ;;
       p) DEBUG_PORT=$OPTARG ;;
       u) RUN_FROM="snapshot" ;;
       *) ;;
   esac
done

TEST_BACKEND_DIR="/workspace/ide-backend-$JB_QUALIFIER"
if [ ! -d "$TEST_BACKEND_DIR" ]; then
  mkdir -p $TEST_BACKEND_DIR
  if [[ $RUN_FROM == "snapshot" ]]; then
    (cd $TEST_BACKEND_DIR &&
    SNAPSHOT_VERSION=$(grep "platformVersion=" "gradle-$JB_QUALIFIER.properties" | sed 's/platformVersion=//') &&
    echo "Downloading the $JB_QUALIFIER version of IntelliJ IDEA ($SNAPSHOT_VERSION)..." &&
    curl -sSLo backend.zip "https://www.jetbrains.com/intellij-repository/snapshots/com/jetbrains/intellij/idea/ideaIU/$SNAPSHOT_VERSION/ideaIU-$SNAPSHOT_VERSION.zip" &&
    unzip backend.zip &&
    rm backend.zip &&
    ln -s "ideaIU-$SNAPSHOT_VERSION" . &&
    rm -r "ideaIU-$SNAPSHOT_VERSION" &&
    cp -r /ide-desktop/backend/jbr . &&
    cp /ide-desktop/backend/bin/idea.properties ./bin &&
    cp /ide-desktop/backend/bin/idea64.vmoptions ./bin)
  else
    if [[ $JB_QUALIFIER == "stable" ]]; then
      PRODUCT_TYPE="release"
    else
      PRODUCT_TYPE="release,rc,eap"
    fi
    (cd $TEST_BACKEND_DIR &&
    echo "Downloading the $JB_QUALIFIER version of IntelliJ IDEA..." &&
    curl -sSLo backend.tar.gz "https://download.jetbrains.com/product?type=$PRODUCT_TYPE&distribution=linux&code=IIU" &&
    tar -xf backend.tar.gz --strip-components=1 &&
    rm backend.tar.gz)
  fi
fi

TEST_PLUGINS_DIR="$TEST_BACKEND_DIR/plugins"
TEST_PLUGIN_DIR="$TEST_PLUGINS_DIR/gitpod-remote"
rm -rf $TEST_PLUGIN_DIR

GITPOD_PLUGIN_DIR=/workspace/gitpod/components/ide/jetbrains/backend-plugin
$GITPOD_PLUGIN_DIR/gradlew -PenvironmentName="$JB_QUALIFIER" buildPlugin

# TODO(ak) actually should be gradle task to make use of output
GITPOD_PLUGIN_DIST="$GITPOD_PLUGIN_DIR/build/distributions/gitpod-remote.zip"
unzip $GITPOD_PLUGIN_DIST -d $TEST_PLUGINS_DIR

TEST_REPO_NAME=$(basename "$TEST_REPO")
TEST_DIR=/workspace/$TEST_REPO_NAME
if [ ! -d "$TEST_DIR" ]; then
  git clone "$TEST_REPO" "$TEST_DIR"
fi

export JB_DEV=true
export JAVA_TOOL_OPTIONS="$JAVA_TOOL_OPTIONS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:$DEBUG_PORT"

# Set default config and system directories under /workspace to preserve between restarts
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# Enable host status endpoint
export CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod

# Build and move idea-cli, then overwrite environment variables initially defined by `components/ide/jetbrains/image/leeway.Dockerfile`
IDEA_CLI_DEV_PATH=$TEST_BACKEND_DIR/bin/idea-cli-dev
(cd ../cli && go build -o $IDEA_CLI_DEV_PATH)
export EDITOR="$IDEA_CLI_DEV_PATH open"
export VISUAL="$EDITOR"
export GP_OPEN_EDITOR="$EDITOR"
export GIT_EDITOR="$EDITOR --wait"
export GP_PREVIEW_BROWSER="$IDEA_CLI_DEV_PATH preview"
export GP_EXTERNAL_BROWSER="$IDEA_CLI_DEV_PATH preview"

export JETBRAINS_GITPOD_BACKEND_KIND=intellij

$TEST_BACKEND_DIR/bin/remote-dev-server.sh run "$TEST_DIR"
