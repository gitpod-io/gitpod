#!/bin/bash

# this script is meant to be sourced

SCRIPT_PATH=$(dirname "${BASH_SOURCE[0]}")

# shellcheck source=./common.sh
source "${SCRIPT_PATH}/common.sh"

TF_CLI_ARGS_plan=${TF_CLI_ARGS_plan:-""}
TF_CLI_ARGS_apply=${TF_CLI_ARGS_apply:-""}

export TF_CLI_ARGS_plan="${TF_CLI_ARGS_plan} -lock-timeout=5m"
export TF_CLI_ARGS_apply="${TF_CLI_ARGS_apply} -lock-timeout=5m"

if [ -n "${DESTROY-}" ]; then
  export TF_CLI_ARGS_plan="${TF_CLI_ARGS_plan} -destroy"
fi

function check_workspace() {
  local workspace=$1
  if [[ $(terraform workspace show) != "${workspace}" ]]; then
    log_error "Expected to be in [${workspace}]. We are in [$(terraform workspace show)]"
    return "${ERROR_WRONG_WORKSPACE}"
  fi
}

function set_workspace() {
  local workspace=$1
  if terraform workspace list | grep -q "${workspace}"; then
    terraform workspace select "${workspace}"
  else
    terraform workspace new "${workspace}"
  fi
}

function delete_workspace() {
  local workspace=$1
  if [[ $(terraform workspace show) == "${workspace}" ]]; then
    terraform workspace select default
  fi

  exists=0
  terraform workspace list | grep -q "${workspace}" || exists=$?
  if [[ "${exists}" == 0 ]]; then
    terraform workspace delete "${workspace}"
  fi
}

function terraform_init() {
  local target_dir=${1:-$TARGET_DIR}
  if [ -z "${target_dir-}" ]; then
    log_error "Must provide TARGET_DIR for init"
    return "${ERROR_NO_DIR}"
  fi
  pushd "${target_dir}" || return "${ERROR_CHANGE_DIR}"

  terraform init
  if [ -n "${WORKSPACE-}" ]; then
    set_workspace "${WORKSPACE}"
    check_workspace "${WORKSPACE}"
  fi

  popd || return "${ERROR_CHANGE_DIR}"
}

function terraform_plan() {
  local target_dir=${1:-$TARGET_DIR}
  if [ -z "${target_dir-}" ]; then
    log_error "Must provide TARGET_DIR for plan"
    return "${ERROR_NO_DIR}"
  fi

  local static_plan
  static_plan="$(realpath "${TARGET_DIR}")/$(basename "${TARGET_DIR}").plan"
  local plan_location=${PLAN_LOCATION:-$static_plan}

  pushd "${target_dir}" || return "${ERROR_CHANGE_DIR}"

  # check if we should be in a workspace, and bail otherwise
  if [ -n "${WORKSPACE-}" ]; then
    set_workspace "${WORKSPACE}"
    check_workspace "${WORKSPACE}"
  fi

  # -detailed-exitcode will be 0=success no changes/1=failure/2=success changes
  # therefore we capture the output so our function doesn't cause a script to terminate if the caller has `set -e`
  EXIT_CODE=0
  terraform plan -detailed-exitcode -out="${plan_location}" || EXIT_CODE=$?

  popd || exit "${ERROR_CHANGE_DIR}"

  return "${EXIT_CODE}"
}

function terraform_apply() {
  local target_dir=${1:-$TARGET_DIR}
  if [ -z "${target_dir-}" ]; then
    log_error "Must provide TARGET_DIR for apply"
    return "${ERROR_NO_DIR}"
  fi

  local static_plan
  static_plan="$(realpath "${TARGET_DIR}")/$(basename "${TARGET_DIR}").plan"
  local plan_location=${PLAN_LOCATION:-$static_plan}

  pushd "${target_dir}" || return "${ERROR_CHANGE_DIR}"

  if [ -z "${plan_location-}" ]; then
    log_error "Must provide PLAN_LOCATION for apply"
    return "${ERROR_NO_PLAN}"
  fi

  # check if we should be in a workspace, and bail otherwise
  if [ -n "${WORKSPACE-}" ]; then
    set_workspace "${WORKSPACE}"
    check_workspace "${WORKSPACE}"
  fi

  timeout --signal=INT --foreground 10m terraform apply "${plan_location}"

  popd || return "${ERROR_CHANGE_DIR}"
}
