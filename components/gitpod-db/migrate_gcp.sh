#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# This scipt connects via Google's cloud_sql_proxy to a database and runs the db-migrations

# ENV variables for configuration:
# * GOOGLE_APPLICATION_CREDENTIALS_DATA: contents of the crendetials files that cloud_sql_proxy uses for authentication
# * GCP_DATABASE: database name
# * DB_PASSWORD: database password

# Example usage:
# docker run --rm \
#            --env GOOGLE_APPLICATION_CREDENTIALS_DATA='...' \
#            --env GCP_DATABASE="gitpod-foobar:europe-west1:gitpod-foobar-baz" \
#            --env DB_PASSWORD="..." \
#            gcr.io/gitpod-core-dev/build/db-migrations:x1 /app/migrate_gcp.sh

set -euo pipefail

# perform migration of 'migrations' table
/app/typeorm.sh query "$(sed '/^--/d' < /app/migrate-migrations/0_2_0_up_procedure.sql)"
/app/typeorm.sh query "CALL migrations_0_2_0_up();"
/app/typeorm.sh query "DROP PROCEDURE IF EXISTS migrations_0_2_0_up;"

/app/typeorm_gcp.sh migrations:run