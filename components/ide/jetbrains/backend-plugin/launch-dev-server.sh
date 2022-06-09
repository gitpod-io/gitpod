#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -e
set -o pipefail

TEST_BACKEND_DIR=/workspace/ide-backend
if [ ! -d "$TEST_BACKEND_DIR" ]; then
  mkdir -p $TEST_BACKEND_DIR
  cp -r /ide-desktop/backend/* $TEST_BACKEND_DIR
fi

TEST_PLUGINS_DIR="$TEST_BACKEND_DIR/plugins"
TEST_PLUGIN_DIR="$TEST_PLUGINS_DIR/gitpod-remote"
rm -rf $TEST_PLUGIN_DIR

GITPOD_PLUGIN_DIR=/workspace/gitpod/components/ide/jetbrains/backend-plugin
$GITPOD_PLUGIN_DIR/gradlew buildPlugin

# TODO(ak) actually should be gradle task to make use of output
GITPOD_PLUGIN_DIST="$GITPOD_PLUGIN_DIR/build/distributions/gitpod-remote-0.0.1.zip"
unzip $GITPOD_PLUGIN_DIST -d $TEST_PLUGINS_DIR

TEST_REPO=https://github.com/gitpod-io/spring-petclinic
TEST_DIR=/workspace/spring-petclinic
if [ ! -d "$TEST_DIR" ]; then
  git clone $TEST_REPO $TEST_DIR
fi

export JB_DEV=true
export JAVA_TOOL_OPTIONS="$JAVA_TOOL_OPTIONS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:0"

# Set default config and system directories under /workspace to preserve between restarts
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# Enable host status endpoint
export CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod

# Build and move idea-cli, then overwrite environment variables initially defined by `components/ide/jetbrains/image/leeway.Dockerfile`
IDEA_CLI_DEV_PATH=/ide-desktop/bin/idea-cli-dev
(cd ../cli && go build -o $IDEA_CLI_DEV_PATH)
export EDITOR="$IDEA_CLI_DEV_PATH open"
export VISUAL="$EDITOR"
export GP_OPEN_EDITOR="$EDITOR"
export GIT_EDITOR="$EDITOR --wait"
export GP_PREVIEW_BROWSER="$IDEA_CLI_DEV_PATH preview"
export GP_EXTERNAL_BROWSER="$IDEA_CLI_DEV_PATH preview"

export JETBRAINS_GITPOD_BACKEND_KIND=intellij

$TEST_BACKEND_DIR/bin/remote-dev-server.sh run $TEST_DIR
