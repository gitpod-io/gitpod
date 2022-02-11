#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

# kill background jobs when the script exits
trap "jobs -p | xargs -r kill" SIGINT SIGTERM EXIT

/ide-desktop/status "$1" "$2" &

echo "Desktop IDE: Waiting for the content initializer ..."
until curl -sS "$SUPERVISOR_ADDR"/_supervisor/v1/status/content/wait/true | grep '"available":true' > /dev/null; do
    sleep 1
done
echo "Desktop IDE: Content available."

if [ "${SUPERVISOR_DEBUG_ENABLE+}" = "true" ]; then
  JAVA_TOOL_OPTIONS="$JAVA_TOOL_OPTIONS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:0"
fi

# Set default config and system directories under /workspace to preserve between restarts
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

# Enable host status endpoint
export CWM_HOST_STATUS_OVER_HTTP_TOKEN=gitpod

/ide-desktop/backend/bin/remote-dev-server.sh run "$GITPOD_REPO_ROOT"

echo "Desktop IDE startup script exited"
