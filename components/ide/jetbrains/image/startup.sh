#!/bin/sh
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo

# kill background jobs when the script exits
trap "jobs -p | xargs -r kill" INT TERM EXIT

# instead put them into /ide-desktop/backend/bin/idea64.vmoptions
# otherwise JB will complain to a user on each startup
# by default remote dev already set -Xmx2048m, see /ide-desktop/backend/plugins/remote-dev-server/bin/launcher.sh
unset JAVA_TOOL_OPTIONS

# enable remote debuggign if debug mode is enabled
if [ "${SUPERVISOR_DEBUG_ENABLE+}" = "true" ]; then
  export JAVA_TOOL_OPTIONS "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:0"
fi

exec /ide-desktop/status "$@"
