#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -euo pipefail

DOMAIN="${1:-""}"
NAMESPACE="${2:-""}"
SECRET_NAME="${3:-""}"
TLS_CRT_KEY="${4:-"tls.crt"}"
TLS_KEY_KEY="${5:-"tls.key"}"

cert_exists="false"
domain="false"
in_date="false"

CRT_FILE="/tmp/tls.crt"
CRT_CONTENTS_FILE="/tmp/tls.crt.txt"
KEY_FILE="/tmp/tls.key"

function get_cert() {
  # Get certificate from secret
  kubectl get secret \
    -n "${NAMESPACE}" \
    "${SECRET_NAME}" \
    -o jsonpath="{.data.${TLS_CRT_KEY//./\\.}}" \
    | base64 -d \
    > "${CRT_FILE}" || return 1

  kubectl get secret \
    -n "${NAMESPACE}" \
    "${SECRET_NAME}" \
    -o jsonpath="{.data.${TLS_KEY_KEY//./\\.}}" \
    | base64 -d \
    > "${KEY_FILE}" || return 1

  # Decode it as an x509 certificate
  openssl x509 -in "${CRT_FILE}" -text -noout > "${CRT_CONTENTS_FILE}"

  CRT_SIG="$(openssl x509 -noout -modulus -in "${CRT_FILE}" | openssl md5)"
  KEY_SIG="$(openssl rsa -noout -modulus -in "${KEY_FILE}" | openssl md5)"

  if [ "${CRT_SIG}" != "${KEY_SIG}" ]; then
    echo "Certificate (${TLS_CRT_KEY}) does not match key (${TLS_KEY_KEY})"
    return 1
  fi
}

function cert_matches_domain_name() {
  grep "${DOMAIN}" "${CRT_CONTENTS_FILE}" || return 1
  grep "\*.${DOMAIN}" "${CRT_CONTENTS_FILE}" || return 1
  grep "\*.ws.${DOMAIN}" "${CRT_CONTENTS_FILE}" || return 1
}

function cert_in_date() {
  DATES="$(openssl x509 -in "${CRT_FILE}" -noout -dates)"

  START_DATE="$(echo "${DATES}" | awk -F= '{a[$1]=$2} END {print(a["notBefore"])}')"
  END_DATE="$(echo "${DATES}" | awk -F= '{a[$1]=$2} END {print(a["notAfter"])}')"

  echo "Certificate start date: ${START_DATE}"
  echo "Certificate end date: ${END_DATE}"

  START_EPOCH="$(date -u -D "%b %e %H:%M:%S %Y" -d "${START_DATE}" "+%s")"
  END_EPOCH="$(date -u -D "%b %e %H:%M:%S %Y" -d "${END_DATE}" "+%s")"
  NOW_EPOCH="$(date -u "+%s")"

  if [ "${NOW_EPOCH}" -gt "${START_EPOCH}" ] && [ "${NOW_EPOCH}" -lt "${END_EPOCH}" ]; then
    echo "Certificate is in date"
    return 0
  fi

  return 1
}

if get_cert; then
  cert_exists="true"

  if cert_matches_domain_name; then
    domain="true"
  fi

  if cert_in_date; then
    in_date="true"
  fi
fi

if [ "${cert_exists}" = "true" ]; then
  echo "cert_exists: ok"
else
  echo "cert_exists: error"
fi

if [ "${domain}" = "true" ]; then
  echo "domain_name: ok"
else
  echo "domain_name: error"
fi

if [ "${in_date}" = "true" ]; then
  echo "in_date: ok"
else
  echo "in_date: error"
fi
