#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -euo pipefail

STORE_PROVIDER="${1:-""}"
STORE_LOCATION="${2:-""}"
AZURE_ACCOUNT_NAME="${3:-""}"
AZURE_ACCESS_KEY="${4:-""}"
GCP_PROJECT_ID="${5:-""}"
GCP_SERVICE_ACCOUNT_KEY="${6:-""}"
S3_ENDPOINT="${7:-""}"
S3_ACCESS_KEY_ID="${8:-""}"
S3_SECRET_ACCESS_KEY="${9:-""}"
S3_BUCKET_NAME="${10:-""}"

bucket_name="kots-check-${RANDOM}-${RANDOM}"
downloaded_file=/tmp/download
file_name="kots-check-file"
file_contents="$(date)"
uploaded_file=/tmp/upload

echo "${file_contents}" > "${uploaded_file}"

connection="false"

function test_azure() {
  echo "Using Azure storage"

  echo "Create a container"
  az storage container create \
    --account-name "${AZURE_ACCOUNT_NAME}" \
    --account-key "${AZURE_ACCESS_KEY}" \
    --name "${bucket_name}" || return 1

  echo "Upload a file"
  az storage blob upload \
    --account-name "${AZURE_ACCOUNT_NAME}" \
    --account-key "${AZURE_ACCESS_KEY}" \
    --container-name "${bucket_name}" \
    --file "${uploaded_file}" \
    --name "${file_name}" || return 1

  echo "Download the file"
  az storage blob download \
    --account-name "${AZURE_ACCOUNT_NAME}" \
    --account-key "${AZURE_ACCESS_KEY}" \
    --container-name "${bucket_name}" \
    --file "${downloaded_file}" \
    --name "${file_name}" || return 1

  echo "Compare the file"
  diff "${downloaded_file}" "${uploaded_file}" || return 1

  echo "Delete the container"
  az storage container delete \
    --name "${bucket_name}" \
    --account-name "${AZURE_ACCOUNT_NAME}" \
    --account-key "${AZURE_ACCESS_KEY}" || return 1
}

function test_gcp() {
  echo "Using GCP storage"

  echo "${GCP_SERVICE_ACCOUNT_KEY}" | base64 -d > /tmp/creds.json

  gcloud auth activate-service-account --project="${GCP_PROJECT_ID}" --key-file=/tmp/creds.json

  echo "Create bucket"
  gsutil mb \
    -l "${STORE_LOCATION}" \
    "gs://${bucket_name}" || return 1

  echo "Upload a file"
  gsutil cp \
    "${uploaded_file}" \
    "gs://${bucket_name}/${file_name}" || return 1

  echo "Download a file"
  gsutil cp \
    "gs://${bucket_name}/${file_name}" \
    "${downloaded_file}" || return 1

  echo "Compare the file"
  diff "${downloaded_file}" "${uploaded_file}" || return 1

  echo "Delete bucket"
  gsutil rm -r \
    "gs://${bucket_name}" || return 1
}

function test_s3() {
  echo "Using S3 storage"

  create_bucket="1"
  s3_bucket_name="${bucket_name}"
  if [ -n "${S3_BUCKET_NAME}" ]; then
    echo "Specify bucket name"
    create_bucket="0"
    s3_bucket_name="${S3_BUCKET_NAME}"
  fi

  echo "Bucket name: ${s3_bucket_name}"

  mc alias set s3 "https://${S3_ENDPOINT}" "${S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY}"

  if [ "${create_bucket}" = "1" ]; then
    echo "Create bucket"
    mc mb \
      --region="${STORE_LOCATION}" \
      "s3/${s3_bucket_name}" || return 1
  fi

  echo "Upload a file"
  mc cp \
    "${uploaded_file}" \
    "s3/${s3_bucket_name}/${file_name}" || return 1

  echo "Download a file"
  mc cp \
    "s3/${s3_bucket_name}/${file_name}" \
    "${downloaded_file}" || return 1

  echo "Compare the file"
  diff "${downloaded_file}" "${uploaded_file}" || return 1

  if [ "${create_bucket}" = "1" ]; then
    echo "Delete bucket"
    mc rb \
      --force \
      "s3/${s3_bucket_name}" || return 1
  else
    echo "Delete file"
    mc rm \
      --force \
      "s3/${s3_bucket_name}/${file_name}" || return 1
  fi
}

case "${STORE_PROVIDER}" in
  azure)
    if test_azure; then
      connection="true"
    fi
    ;;
  gcp)
    if test_gcp; then
      connection="true"
    fi
    ;;
  incluster)
    echo "Using in-cluster storage"
    connection="true"
    ;;
  s3)
    if test_s3; then
      connection="true"
    fi
    ;;
  *)
    echo "Unknown storage type: '${STORE_PROVIDER}'"
    exit 1
    ;;
esac

if [ "${connection}" = "true" ]; then
  echo "connection: ok"
else
  echo "connection: error"
  exit 1
fi
