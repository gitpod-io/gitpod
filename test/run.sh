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
set -x

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

THIS_DIR="$(dirname "$(readlink -f "$0")")"
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
args+=( "-timeout=120m" )

if [[ "${GITPOD_REPO_ROOT:-}" != "" ]]; then
  echo "Running in Gitpod workspace. Fetching USER_NAME and USER_TOKEN"
  USER_NAME="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.username}' | base64 -d)"
  USER_TOKEN="$(kubectl --context=dev -n werft get secret integration-test-user -o jsonpath='{.data.token}' | base64 -d)"
  export USER_NAME
  export USER_TOKEN
else
  echo "Using INTEGRATION_TEST_USERNAME and INTEGRATION_TEST_USER_TOKEN for USER_NAME and USER_TOKEN"
  USER_NAME="${INTEGRATION_TEST_USERNAME}"
  USER_TOKEN="${INTEGRATION_TEST_USER_TOKEN}"
  export USER_NAME
  export USER_TOKEN
fi

[[ "$USER_NAME" != "" ]] && args+=( "-username=$USER_NAME" )

go install github.com/jstemmer/go-junit-report/v2@latest

if ! npm list -g xunit-viewer; then npm install -g xunit-viewer; fi

RESULTS_DIR="${THIS_DIR}/results/$(date +%Y-%m-%d-%H-%M-%S)"
mkdir -p "${RESULTS_DIR}"

if [ "$TEST_SUITE" == "workspace" ]; then
  TEST_NAME="workspace"
  LOG_FILE="${LOGS_DIR}/${TEST_NAME}.log"

  cd "$THIS_DIR"
  echo "running integration for ${TEST_NAME}"

  set +e
  # shellcheck disable=SC2086
  go test -p 4 -v $TEST_LIST "${args[@]}" -parallel-features=true -skip-labels="type=maintenance" 2>&1  | go-junit-report -subtest-mode=exclude-parents -set-exit-code -out "${RESULTS_DIR}/TEST-${TEST_NAME}.xml" -iocopy
  RC=${PIPESTATUS[0]}
  set -e

  if [ "${RC}" -ne "0" ]; then
    FAILURE_COUNT=$((FAILURE_COUNT+1))
  fi

  set +e
  # shellcheck disable=SC2086
  go test -v $TEST_LIST "${args[@]}" -labels="type=maintenance" 2>&1
  RC=${PIPESTATUS[0]}
  set -e

  if [ "${RC}" -ne "0" ]; then
    FAILURE_COUNT=$((FAILURE_COUNT+1))
  fi

  cd -
  if [ "${REPORT}" != "" ]; then
     "${THIS_DIR}/report.sh" "${LOG_FILE}" > "$REPORT"
  fi
else
  for TEST_PATH in ${TEST_LIST}
  do
    TEST_NAME=$(basename "${TEST_PATH}")
    LOG_FILE="${LOGS_DIR}/${TEST_NAME}.log"
    echo "running integration for ""${TEST_NAME}"""

    cd "${TEST_PATH}"
    set +e
    go test -parallel=3 -v ./... "${args[@]}" 2>&1 | go-junit-report -subtest-mode=exclude-parents -set-exit-code -out "${RESULTS_DIR}/TEST-${TEST_NAME}.xml" -iocopy
    RC=${PIPESTATUS[0]}
    set -e
    cd -

    if [ "${RC}" -ne "0" ]; then
      FAILURE_COUNT=$((FAILURE_COUNT+1))
    fi
  done
fi

set +e
xunit-viewer -r "${RESULTS_DIR}" -o "${THIS_DIR}/test-output.html"
pkill -f "port-forward"
set -e

exit $FAILURE_COUNT
