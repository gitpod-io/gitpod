#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

# kill background jobs when the script exits
trap "jobs -p | xargs -r kill" SIGINT SIGTERM EXIT

# instead put them into /ide-desktop/backend/bin/idea64.vmoptions
# otherwise JB will complain to a user on each startup
# by default remote dev already set -Xmx2048m, see /ide-desktop/backend/plugins/remote-dev-server/bin/launcher.sh
unset JAVA_TOOL_OPTIONS

# enable remote debuggign if debug mode is enabled
if [ "${SUPERVISOR_DEBUG_ENABLE+}" = "true" ]; then
  export JAVA_TOOL_OPTIONS "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:0"
fi

# Set default config and system directories under /workspace to preserve between restarts
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# Enable host status endpoint
export CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod

/ide-desktop/status "$1" "$2"