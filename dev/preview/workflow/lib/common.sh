#!/bin/bash

# this script is meant to be sourced

SCRIPT_PATH=$(dirname "${BASH_SOURCE[0]}")

# predefined exit codes for checks
export ERROR_WRONG_WORKSPACE=30
export ERROR_CHANGE_DIR=31
export ERROR_NO_WORKSPACE=32
export ERROR_NO_DIR=33
export ERROR_NO_PLAN=34
export ERROR_PLAN_FAIL=35

function import() {
  local file="${SCRIPT_PATH}/${1}"
  if [ -f "${file}" ]; then
    # shellcheck disable=SC1090
    source "${file}"
  else
    echo "Error: Cannot find library at: ${file}"
    exit 1
  fi
}

# define some colors for our helper log function
BLUE='\033[0;34m'
RED='\033[0;31m'
GREEN='\033[0;32m'
# NC=no color
NC='\033[0m'

function log_error() {
  local text=$1
  echo -e "${RED}ERROR: ${NC}${text}" 1>&2
}

function log_success() {
  local text=$1
  echo -e "${GREEN}SUCCESS: ${NC}${text}"
}

function log_info() {
  local text=$1
  echo -e "${BLUE}INFO: ${NC}${text}"
}

function ask() {
    while true; do
        # shellcheck disable=SC2162
        read -p "$* [y/n]: " yn
        case $yn in
            [Yy]*) return 0  ;;
            [Nn]*) echo "Aborted" ; return  1 ;;
        esac
    done
}
