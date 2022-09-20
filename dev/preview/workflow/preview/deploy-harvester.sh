#!/bin/bash

# shellcheck disable=SC2034

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

# terraform function
import "terraform.sh"

PROJECT_ROOT=$(realpath "${SCRIPT_PATH}/../../../../")

if [[ -n ${WERFT_HOST+x} ]]; then
  TF_CLI_ARGS="-input=false"
  TF_IN_AUTOMATION=true
fi

WORKSPACE="${TF_VAR_preview_name:-}"
TARGET_DIR="${PROJECT_ROOT}/dev/preview/infrastructure/harvester"
# Setting the TF_DATA_DIR is advisable if we set the PLAN_LOCATION in a different place than the dir with the tf
TF_DATA_DIR="${TARGET_DIR}"

# Illustration purposes, but this will set the plan location to $TARGET_DIR/harvester.plan if PLAN_LOCATION is not set
static_plan="$(realpath "${TARGET_DIR}")/$(basename "${TARGET_DIR}").plan"
PLAN_LOCATION="${PLAN_LOCATION:-$static_plan}"

# export all variables
shopt -os allexport

terraform_init

PLAN_EXIT_CODE=0
terraform_plan || PLAN_EXIT_CODE=$?

# If there are changes
if [[ ${PLAN_EXIT_CODE} == 2 ]]; then
  # If we're NOT in werft, ask if we want to apply the plan
  if [ -z ${WERFT_HOST+x} ]; then
    ask "Do you want to apply the plan?"
  fi
  terraform_apply
fi

if [ -n "${DESTROY-}" ] && [ -n "${WORKSPACE}" ]; then
  pushd "${TARGET_DIR}"
  delete_workspace "${WORKSPACE}"
  popd
fi
