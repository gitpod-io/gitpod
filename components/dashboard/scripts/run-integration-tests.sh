#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


wait_port() {
    local RC=1;
    while [ $RC -ne 0 ]; do
        curl -s --max-time "$1" "$2" > /dev/null;
        RC=$?;
    done
}

trap "exit" INT TERM SIGINT SIGTERM
trap "kill 0" EXIT

# start dashboard in background
yarn start &

# wait for the dashboard to become available
echo "waiting 60s for localhost:3000 to open..."
wait_port 60 localhost:3000
echo "localhost:3000 responded, running tests."

# run actual tests
yarn test:integration:run