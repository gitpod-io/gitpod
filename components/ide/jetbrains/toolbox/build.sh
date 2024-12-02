#!/bin/bash
# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -e

JB_GP_VERSION=${1}

./gradlew -PsupervisorApiProjectPath=components-supervisor-api-java--lib/ -PgitpodPublicApiProjectPath=components-public-api-java--lib/ -PenvironmentName="$JB_QUALIFIER" -Dgradle.user.home="/workspace/.gradle-tb-$JB_QUALIFIER" -Dplugin.verifier.home.dir="$HOME/.cache/pluginVerifier-tb-$JB_QUALIFIER" -PpluginVersion="$JB_GP_VERSION" pluginZip

# # TODO(hw): Improve me
# tarDir="/tmp/tb-build"
# mkdir -p "$tarDir"
# mv ./build/distributions/io.gitpod.toolbox.gateway-0.0.1-dev.zip "$tarDir/io.gitpod.toolbox.gateway-0.0.1-dev.zip"
# echo "GITPOD_PLUGIN_ZIP=$tarDir/io.gitpod.toolbox.gateway-0.0.1-dev.zip" >> /tmp/__gh_output.txt
# # unzip ./build/distributions/io.gitpod.toolbox.gateway-0.0.1-dev.zip -d ./build
