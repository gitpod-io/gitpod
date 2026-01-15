#!/bin/bash
# shellcheck disable=1091
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
  export TF_IN_AUTOMATION=true
fi

export TF_WORKSPACE="${TF_VAR_preview_name:-$TF_WORKSPACE}"
TARGET_DIR="${PROJECT_ROOT}/dev/preview/infrastructure"
# Setting the TF_DATA_DIR is advisable if we set the PLAN_LOCATION in a different place than the dir with the tf
TF_DATA_DIR="${TARGET_DIR}"

# Illustration purposes, but this will set the plan location to $TARGET_DIR/infrastructure.plan if PLAN_LOCATION is not set
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
  # Don't exit yet if DESTROY is set - we still need to delete the workspace
  if [ -z "${DESTROY-}" ]; then
    exit 0
  fi
  ;;
1)
  log_error "Terraform plan failed"
  exit "${ERROR_PLAN_FAIL}"
  ;;
2)
  # If we don't require tf input, ask for the plan
  if [[ -z ${TF_IN_AUTOMATION+x} ]]; then
    ask "Do you want to apply the plan?"
  fi
  terraform_apply
  ;;
esac

if [ -n "${DESTROY-}" ] && [ -n "${TF_WORKSPACE}" ]; then
  pushd "${TARGET_DIR}"
  delete_workspace "${TF_WORKSPACE}"
  popd
fi
