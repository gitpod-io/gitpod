#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

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

$TEST_BACKEND_DIR/bin/remote-dev-server.sh run $TEST_DIR