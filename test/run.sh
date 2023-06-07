#!/usr/bin/env bash
#
# Convenience script to run our integration tests suites.
#
# Usage:
#
#   run.sh --suite [suite] --report [report_file]
#
# Examples
#
#   run.sh                        This will run all test suites
#   run.sh -s ide                 This will run just the 'ide' test suite
#   run.sh -s ide -r report.csv   This will run just the 'ide' test suite with the report for the quality assurance
#

set -euo pipefail

REPORT=""
TEST_SUITE=all
opt=""
optarg=""
while getopts rs-: opt; do
  optarg="${!OPTIND}"
  [[ "$opt" = - ]] && opt="-$OPTARG"
  case "-$opt" in
    -r|--report)
      REPORT=${optarg}
      shift
      ;;
    -s|--suit)
      TEST_SUITE=${optarg}
      shift
      ;;
    *) ;;
  esac
done
shift $((OPTIND - 1))

THIS_DIR="$(dirname "$0")"
FAILURE_COUNT=0
LOGS_DIR=$(mktemp -d)

WEBAPP_TEST_LIST="$THIS_DIR/tests/components/database $THIS_DIR/tests/components/server"
JETBRAINS_TESTS="$THIS_DIR/tests/ide/jetbrains"
VSCODE_TESTS="$THIS_DIR/tests/ide/vscode"
SSH_TESTS="$THIS_DIR/tests/ide/ssh"
IDE_TEST_LIST="$SSH_TESTS $VSCODE_TESTS $JETBRAINS_TESTS"
WORKSPACE_TEST_LIST="$THIS_DIR/tests/components/ws-manager $THIS_DIR/tests/components/image-builder $THIS_DIR/tests/components/content-service $THIS_DIR/tests/components/ws-daemon $THIS_DIR/tests/workspace"

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
    echo "Unknown test suite '${TEST_SUITE}'"
    exit 1
esac

args=()
if [ "${REPORT}" != "" ]; then
  args+=( "--json" )
fi
args+=( "-kubeconfig=${KUBECONFIG:-/home/gitpod/.kube/config}" )
args+=( "-namespace=${NAMESPACE:-default}" )
args+=( "-timeout=60m" )
args+=( "-p=2" )

if [[ "${GITPOD_REPO_ROOT:-}" != "" ]]; then
  echo "Running in Gitpod workspace. Fetching USERNAME and USER_TOKEN"
  USERNAME="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.username}' | base64 -d)"
  USER_TOKEN="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.token}' | base64 -d)"
  export USER_TOKEN
else
  echo "Using INTEGRATION_TEST_USERNAME and INTEGRATION_TEST_USER_TOKEN for USERNAME and USER_TOKEN"
  USERNAME="${INTEGRATION_TEST_USERNAME}"
  USER_TOKEN="${INTEGRATION_TEST_USER_TOKEN}"
  export USERNAME
  export USER_TOKEN
fi

[[ "$USERNAME" != "" ]] && args+=( "-username=$USERNAME" )

go install github.com/jstemmer/go-junit-report/v2@latest
npm i -g xunit-viewer
mkdir -p results

if [ "$TEST_SUITE" == "workspace" ]; then
  TEST_NAME="workspace"
  LOG_FILE="${LOGS_DIR}/${TEST_NAME}.log"

  cd "$THIS_DIR"
  echo "running integration for ${TEST_NAME}-parallel"

  set +e
  # shellcheck disable=SC2086
  go test -p 1 -v $TEST_LIST "${args[@]}" -run '.*[^.SerialOnly]$' 2>&1  | go-junit-report -subtest-mode=exclude-parents -set-exit-code -out "results/TEST-${TEST_NAME}-SERIAL.xml" -iocopy
  RC=${PIPESTATUS[0]}
  set -e

  if [ "${RC}" -ne "0" ]; then
    FAILURE_COUNT=$((FAILURE_COUNT+1))
  fi

  echo "running integration for ${TEST_NAME}-serial-only"
  set +e
  # shellcheck disable=SC2086
  go test -p 1 --parallel 1 -v $TEST_LIST "${args[@]}" -run '.*SerialOnly$' -p 1 2>&1 | go-junit-report -subtest-mode=exclude-parents -set-exit-code -out "results/TEST-${TEST_NAME}-PARALLEL.xml" -iocopy
  RC=${PIPESTATUS[0]}
  set -e

  if [ "${RC}" -ne "0" ]; then
    FAILURE_COUNT=$((FAILURE_COUNT+1))
  fi

  cd -
  if [ "${REPORT}" != "" ]; then
     ./report.sh "${LOG_FILE}" > "$REPORT"
  fi
else
  for TEST_PATH in ${TEST_LIST}
  do
    TEST_NAME=$(basename "${TEST_PATH}")
    LOG_FILE="${LOGS_DIR}/${TEST_NAME}.log"
    echo "running integration for ""${TEST_NAME}"""

    cd "${TEST_PATH}"
    set +e
    go test -v ./... "${args[@]}" 2>&1 | go-junit-report -subtest-mode=exclude-parents -set-exit-code -out "results/TEST-${TEST_NAME}.xml" -iocopy
    RC=${PIPESTATUS[0]}
    set -e
    cd -

    if [ "${RC}" -ne "0" ]; then
      FAILURE_COUNT=$((FAILURE_COUNT+1))
    fi
  done
fi

xunit-viewer -r ./results -o test-output.html

exit $FAILURE_COUNT
