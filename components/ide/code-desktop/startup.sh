#!/bin/sh
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo

# kill background jobs when the script exits
trap "jobs -p | xargs -r kill" INT TERM EXIT

/ide-desktop/status "$1" "$2" "$3"

echo "Desktop IDE startup script exited"
