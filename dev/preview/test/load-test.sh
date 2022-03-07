#!/usr/bin/env bash
#
# This script makes it possible to run load tests against VM-based preview
# environments.
#
# Usage:
#   ./dev/preview/test/load-test.sh
#   ./dev/preview/test/load-test.sh --base-branch-name test --start 1 --end 5 --interval 30
#

set -euo pipefail

function log {
    echo "[$(date)] $*"
}

START=1
END=15
INTERVAL=30
BASE_BRANCH_NAME="vm-load-test"
BRANCH_SUFFIX="with-vm"

opts=$(getopt \
  --longoptions "start:,end:,base-branch-name:" \
  --name "$(basename "$0")" \
  --options "" \
  -- "$@"
)

eval set -- "$opts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start) START=$2 ; shift 2 ;;
    --end) END=$2 ; shift 2 ;;
    --base-branch-name) BASE_BRANCH_NAME=$2 ;  shift 2 ;;
    --interval) INTERVAL=$2 ; shift 2 ;;
    *) break ;;
  esac
done

while true; do
    read -rp "
Are you sure you want to run the load test with the following configuration?

START=${START}
END=${END}
INTERVAL=${INTERVAL}
BASE_BRANCH_NAME=${BASE_BRANCH_NAME}

y/n: " yn
    case "$yn" in
        [Yy]* ) break;;
        [Nn]* ) echo "Aborting load test" ; exit 0;;
        * ) echo "Please answer y/n";;
    esac
done

FULL_BRANCH_NAME="${BASE_BRANCH_NAME}-${BRANCH_SUFFIX}"
log "Creating base branch ${FULL_BRANCH_NAME}"
git checkout -b "${FULL_BRANCH_NAME}"

for number in $(seq "${START}" "${END}"); do
    branch="${FULL_BRANCH_NAME}-${number}"

    log "Creating and pushing branch ${branch}"
    git checkout -b "${branch}"
    git push -u origin "${branch}"

    log "Back to base branch ${FULL_BRANCH_NAME}"
    git checkout "${FULL_BRANCH_NAME}"

    log "Sleeping ${INTERVAL} seconds"
    sleep "$INTERVAL"
done
