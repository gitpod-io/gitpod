#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.


set -euo pipefail

DB_IN_CLUSTER_ENABLED="${1:-""}"
DB_CLOUDSQL_ENABLED="${2:-""}"
DB_USERNAME="${3:-""}"
DB_PASSWORD="${4:-""}"
DB_HOST="${5:-""}"
DB_PORT="${6:-""}"
CSP_INSTANCES="${7:-""}"
CSP_CREDENTIALS="${8:-""}"

connection="false"
version=""

DB_TYPE="incluster"
if [ "${DB_IN_CLUSTER_ENABLED}" == "0" ]; then
  if [ "${DB_CLOUDSQL_ENABLED}" == "1"  ]; then
    DB_TYPE="cloudsqlproxy"
  else
    DB_TYPE="external"
  fi
fi

case "${DB_TYPE}" in
  cloudsqlproxy | external)
    if [ "${DB_TYPE}" = "cloudsqlproxy" ]; then
      echo "Connecting to CloudSQLProxy"

      CREDENTIALS_FILE="/tmp/credentials.json"
      echo "${CSP_CREDENTIALS}" | base64 -d > "${CREDENTIALS_FILE}"

      # Config overrides
      DB_HOST="0.0.0.0"
      DB_PORT="8080"

      # This is a long-running process
      cloud_sql_proxy \
        --instances="${CSP_INSTANCES}=tcp:${DB_PORT}" \
        -credential_file="${CREDENTIALS_FILE}" &

      # Give it a chance to connect
      sleep 5
    else
      echo "Using external database"
    fi

    # Check the database version
    version_query=$(mysql \
      --connect-timeout=5 \
      --database=gitpod \
      --user="${DB_USERNAME}" \
      --password="${DB_PASSWORD}" \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --execute="SELECT VERSION();" \
      --silent \
      --raw \
      --skip-column-names || echo "fail")

    if [ "${version_query}" != "fail" ]; then
      connection="true"
      version="${version_query}"
    fi
    ;;
  incluster)
    echo "Using in-cluster database"
    connection="true"
    version="5.7"
    ;;
  *)
    echo "Unknown database type: '${DB_TYPE}'"
    exit 1
    ;;
esac

if [ "${connection}" = "true" ]; then
  echo "connection: ok"
else
  echo "connection: error"
fi
echo "version: ${version}"
