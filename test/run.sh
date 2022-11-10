#!/usr/bin/env bash
#
# Convenience script to run our integration tests suites.
#
# Usage:
#
#   run.sh [suite]
#
# Examples
#
#   run.sh          This will run all test suites
#   run.sh ide      This will run just the 'ide' test suite
#

set -euo pipefail

THIS_DIR="$(dirname "$0")"
TEST_SUITE=${1:-'all'}
FAILURE_COUNT=0
LOGS_DIR=$(mktemp -d)

WEBAPP_TEST_LIST="$THIS_DIR/tests/components/database $THIS_DIR/tests/components/server"

JETBRAINS_TESTS="$THIS_DIR/tests/ide/jetbrains"
VSCODE_TESTS="$THIS_DIR/tests/ide/vscode"
SSH_TESTS="$THIS_DIR/tests/ide/ssh"
IDE_TEST_LIST="$SSH_TESTS $VSCODE_TESTS $JETBRAINS_TESTS"

WORKSPACE_TEST_LIST="$THIS_DIR/tests/components/content-service $THIS_DIR/tests/components/image-builder $THIS_DIR/tests/components/ws-daemon $THIS_DIR/tests/components/ws-manager $THIS_DIR/tests/workspace"

case $TEST_SUITE in
  "webapp")
    TEST_LIST="$WEBAPP_TEST_LIST"
    ;;
  "ide")
    TEST_LIST="$IDE_TEST_LIST"
    ;;
  "jetbrains")
    TEST_LIST="$JETBRAINS_TESTS"
    ;;
  "vscode")
    TEST_LIST="$VSCODE_TESTS"
    ;;
  "ssh")
    TEST_LIST="$SSH_TESTS"
    ;;
  "workspace")
    TEST_LIST="${WORKSPACE_TEST_LIST}"
    ;;
  "" | "all")
    TEST_LIST="${WEBAPP_TEST_LIST} ${IDE_TEST_LIST} ${WORKSPACE_TEST_LIST}"
    ;;
  *)
    echo "Unknown test suite ${TEST_SUITE}"
    exit 1
esac

args=()
args+=( "-kubeconfig=${KUBECONFIG:-/home/gitpod/.kube/config}" )
args+=( "-namespace=default" )
args+=( "-timeout=60m" )
args+=( "-p=1" )

if [[ "${GITPOD_REPO_ROOT:-}" != "" ]]; then
  echo "Running in Gitpod workspace. Fetching USERNAME and USER_TOKEN" | werft log slice "test-setup"
  USERNAME="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.username}' | base64 -d)"
  USER_TOKEN="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.token}' | base64 -d)"
  export USER_TOKEN
else
  echo "Running in Werft. Using INTEGRATION_TEST_USERNAME and INTEGRATION_TEST_USER_TOKEN for USERNAME and USER_TOKEN"  | werft log slice "test-setup"
  USERNAME="${INTEGRATION_TEST_USERNAME}"
  USER_TOKEN="${INTEGRATION_TEST_USER_TOKEN}"
  export USERNAME
  export USER_TOKEN
fi
werft log slice "test-setup" --done

[[ "$USERNAME" != "" ]] && args+=( "-username=$USERNAME" )

for TEST_PATH in ${TEST_LIST}
do
  TEST_NAME=$(basename "${TEST_PATH}")
  LOG_FILE="${LOGS_DIR}/${TEST_NAME}.log"
  echo "running integration for ${TEST_NAME} - log file at ${LOG_FILE}" | werft log slice "test-${TEST_NAME}"

  cd "${TEST_PATH}"
  set +e
  go test -v ./... "${args[@]}" 2>&1 | tee "${LOG_FILE}" | werft log slice "test-${TEST_NAME}"
  RC=${PIPESTATUS[0]}
  set -e
  cd -

  if [ "${RC}" -ne "0" ]; then
    FAILURE_COUNT=$((FAILURE_COUNT+1))
    werft log slice "test-${TEST_NAME}" --fail "${RC}"
  else
    werft log slice "test-${TEST_NAME}" --done
  fi
done

exit $FAILURE_COUNT
