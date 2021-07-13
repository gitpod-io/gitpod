#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# This scipt connects via Google's cloud_sql_proxy to a database and runs typeorm, e.g. to run or revert db-migrations

# ENV variables for configuration:
# * GOOGLE_APPLICATION_CREDENTIALS_DATA: contents of the crendetials files that cloud_sql_proxy uses for authentication
# * GCP_DATABASE: database name
# * DB_PASSWORD: database password

# Example usage:
# docker run --rm \
#            --env GOOGLE_APPLICATION_CREDENTIALS_DATA='...' \
#            --env GCP_DATABASE="gitpod-foobar:europe-west1:gitpod-foobar-baz" \
#            --env DB_PASSWORD="..." \
#            gcr.io/gitpod-core-dev/build/db-migrations:x1 /app/typeorm_gcp.sh migrations:run

set -euo pipefail

echo "$GOOGLE_APPLICATION_CREDENTIALS_DATA" > /tmp/gcp.json

# start the proxy and background it
GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp.json cloud_sql_proxy -instances="$GCP_DATABASE=tcp:3306" &
proxy_pid=$!

# run db-migrations
DB_PORT=3306 /app/typeorm.sh "$@"

# stop the proxy
kill $proxy_pid
wait $proxy_pid
