#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

if [ "${JETBRAINS_VERIFY+}" = "true" ]; then
    ./gradlew -PsupervisorApiProjectPath=components-supervisor-api-java--lib/ -PgitpodProtocolProjectPath=components-gitpod-protocol-java--lib/ -PenvironmentName="$JETBRAINS_VERSION_QUALIFIER" runPluginVerifier
fi
./gradlew -PsupervisorApiProjectPath=components-supervisor-api-java--lib/ -PgitpodProtocolProjectPath=components-gitpod-protocol-java--lib/ -PenvironmentName="$JETBRAINS_VERSION_QUALIFIER" buildPlugin
unzip ./build/distributions/gitpod-remote-0.0.1.zip -d ./build
