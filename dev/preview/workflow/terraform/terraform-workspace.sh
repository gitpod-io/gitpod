#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

import "terraform.sh"

if [ -z "${WORKSPACE-}" ]; then
  log_error "Must provide WORKSPACE"
  exit "${ERROR_NO_WORKSPACE}"
fi

if [ -z "${TARGET_DIR-}" ]; then
  log_error "Must provide TARGET_DIR"
  exit "${ERR_NO_DIR}"
fi

if [ -z "${DESTROY-}" ]; then
  set_workspace "${WORKSPACE}"
else
  pushd "${TARGET_DIR}"
  delete_workspace "${WORKSPACE}"
  popd
fi
