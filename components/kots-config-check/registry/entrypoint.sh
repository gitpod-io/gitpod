#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -euo pipefail

REG_IN_CLUSTER_ENABLED="${1:-""}"
REG_USERNAME="${2:-""}"
REG_PASSWORD="${3:-""}"
REG_URL="${4:-""}"
REG_SERVER="${5:-""}"
REG_IN_CLUSTER_S3_ENABLED="${6:-""}"
REG_STORE_LOCATION="${7:-""}"
REG_S3_ENDPOINT="${8:-""}"
REG_S3_ACCESS_KEY_ID="${9:-""}"
REG_S3_SECRET_ACCESS_KEY="${10:-""}"
REG_S3_BUCKET_NAME="${11:-""}"

connection="false"
s3connection="false"

REG_TYPE="incluster"
if [ "${REG_IN_CLUSTER_ENABLED}" == "0" ]; then
  REG_TYPE="external"
fi

case "${REG_TYPE}" in
  external)
    echo "Using external registry"

    REG_SERVER_ADDRESS="${REG_URL}"
    if [ "${REG_SERVER}" != "" ]; then
      REG_SERVER_ADDRESS="${REG_SERVER}"
    fi

    # Check the registry connection
    if /app/registry \
      check \
      --server-address="${REG_SERVER_ADDRESS}" \
      --username="${REG_USERNAME}" \
      --password="${REG_PASSWORD}"; then
      connection="true"
    fi

    s3connection="true"
    ;;
  incluster)
    echo "Using in-cluster registry"
    connection="true"

    # This is "true" or "false" not "1" or "0"
    if [ "${REG_IN_CLUSTER_S3_ENABLED}" == "true" ]; then
      # The Azure and GCP arguments are ignored - use variable names so it's readable
      if bash /storage.sh \
        "s3" \
        "${REG_STORE_LOCATION}" \
        "AZURE_ACCOUNT_NAME" \
        "AZURE_ACCESS_KEY" \
        "GCP_PROJECT_ID" \
        "GCP_SERVICE_ACCOUNT_KEY" \
        "${REG_S3_ENDPOINT}" \
        "${REG_S3_ACCESS_KEY_ID}" \
        "${REG_S3_SECRET_ACCESS_KEY}" \
        "${REG_S3_BUCKET_NAME}"; then
        s3connection="true"
      fi
    else
      s3connection="true"
    fi
    ;;
  *)
    echo "Unknown registry type: '${REG_TYPE}'"
    exit 1
    ;;
esac

if [ "${connection}" = "true" ]; then
  echo "registry: ok"
else
  echo "registry: error"
fi
if [ "${s3connection}" = "true" ]; then
  echo "s3: ok"
else
  echo "s3: error"
fi
