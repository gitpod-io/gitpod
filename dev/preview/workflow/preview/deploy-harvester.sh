#!/bin/bash

# shellcheck disable=SC2034

set -euo pipefail

SCRIPT_PATH=$(realpath "$(dirname "$0")")

# shellcheck source=../lib/common.sh
source "$(realpath "${SCRIPT_PATH}/../lib/common.sh")"

# terraform function
import "terraform.sh"

PROJECT_ROOT=$(realpath "${SCRIPT_PATH}/../../../../")

if [[ -n ${WERFT_SERVICE_HOST+x} ]]; then
  export TF_INPUT=0
  TF_IN_AUTOMATION=true
fi

WORKSPACE="${TF_VAR_preview_name:-$WORKSPACE}"
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

case ${PLAN_EXIT_CODE} in
0)
  log_success "No changes to the plan"
  exit 0
  ;;
1)
  log_error "Terraform plan failed"
  exit "${ERROR_PLAN_FAIL}"
  ;;
2)
  # If we're NOT in werft, ask if we want to apply the plan
  if [ -z ${WERFT_SERVICE_HOST+x} ]; then
    ask "Do you want to apply the plan?"
  fi
  terraform_apply
  ;;
esac

if [ -n "${DESTROY-}" ] && [ -n "${WORKSPACE}" ]; then
  pushd "${TARGET_DIR}"
  delete_workspace "${WORKSPACE}"
  popd
fi
