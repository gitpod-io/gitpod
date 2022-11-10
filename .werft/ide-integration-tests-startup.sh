#!/usr/bin/env bash

set -euo pipefail

sudo chown -R gitpod:gitpod /workspace

# Fix weird repeat running behavior
LAST_COMMIT_MSG=$(git log --pretty=format:"%s" -1)
if [[ $LAST_COMMIT_MSG =~ "integration test" ]]; then exit 0; fi

BRANCH="inte-test/"$(date +%Y%m%d%H%M%S)
FAILURE_COUNT=0
RUN_COUNT=0 # Prevent multiple cleanup runs
DO_CLEANUP=0
REVISION=""
declare -A FAILURE_TESTS
declare SIGNAL # used to record signal caught by trap

context_name=$1
context_repo=$2

function cleanup ()
{
    werft log phase "slack notification and cleanup $SIGNAL" "Slack notification and cleanup: $SIGNAL"
    echo "Check if cleanup has already done" | werft log slice "Check if clenup has already done"
    if [[ $DO_CLEANUP -eq 1 ]]; then
        echo "Skip clean up" | werft log slice "Check if clenup has already done" --done
        return 0
    fi
    DO_CLEANUP=1
    werft log slice "Check if clenup has already done" --done

    werftJobUrl="https://werft.gitpod-dev.com/job/${context_name}"

    if [ "${RUN_COUNT}" -eq "0" ]; then
        title=":x: *IDE integration test fail*"
        title=$title"\n_Repo:_ ${context_repo}\n_Revision:_ ${REVISION}\n_Build:_ ${context_name}"

        errs="Failed at preparing the preview environment"
        BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
    elif [ "${FAILURE_COUNT}" -ne "0" ]; then
        title=":x: *IDE integration test fail*"
        title=$title"\n_Repo:_ ${context_repo}\n_Revision:_ ${REVISION}\n_Build:_ ${context_name}"

        errs=""
        for TEST_NAME in ${!FAILURE_TESTS[*]}; do
          title=$title"\n_Tests_: ${TEST_NAME}"
          errs+="${FAILURE_TESTS["${TEST_NAME}"]}"
        done
        errs=$(echo "${errs}" | head)
        BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
    else
        title=":white_check_mark: *IDE integration test pass*"

        title=$title"\n_Repo:_ ${context_repo}\n_Revision:_ ${REVISION}\n_Build:_ ${context_name}"
        BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}}]}"
    fi

    echo "Sending Slack notificaition" | werft log slice "slack notification"
    curl -X POST \
      -H 'Content-type: application/json' \
      -d "${BODY}" \
      "https://hooks.slack.com/${SLACK_NOTIFICATION_PATH}"
    werft log result "slack notification" "${PIPESTATUS[0]}"
    werft log slice "slack notification" --done

    git push origin :"${BRANCH}" | werft log slice "clean up"

    echo "Finished cleaning up based on signal $SIGNAL" | werft log slice "clean up"
    werft log slice "clean up" --done
}

sudo chown -R gitpod:gitpod /workspace
gcloud auth activate-service-account --key-file /mnt/secrets/gcp-sa/service-account.json
export GOOGLE_APPLICATION_CREDENTIALS="/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json"

git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io
git remote set-url origin https://oauth2:"${ROBOQUAT_TOKEN}"@github.com/gitpod-io/gitpod.git

werft log phase "build preview environment" "build preview environment"

REVISION=$(git show -s --format="%h" HEAD)

# Create a new branch and asks Werft to create a preview environment for it
( \
    git checkout -B "${BRANCH}" && \
    git commit -m "ide integration test" --allow-empty  && \
    git push --set-upstream origin "${BRANCH}" && \
    werft run github -a with-preview=true -a with-large-vm=true
) | werft log slice "build preview environment"

for signal in SIGINT SIGTERM EXIT; do
  # shellcheck disable=SC2064
  # We intentionally want the expansion to happen here as that's how we pass the signal to the function.
  trap "SIGNAL=${signal};cleanup" $signal
done

# Our current approach will start two Werft jobs. One triggered by Werft by the push to the branch and one
# due to the `werft run` invocation above - the manual invocation is needed as we don't enable preview
# environments by default.
#
# Below we find the job id of the the build that has 'with-preview' set. We don't care about the other job.
#
BUILD_ID=$(werft job list repo.ref==refs/heads/"${BRANCH}" -o yaml | yq4 '.result[] | select(.metadata.annotations[].key == "with-preview") | .name' | head -1)
until [ "$BUILD_ID" != "" ]
do
    sleep 1
    BUILD_ID=$(werft job list repo.ref==refs/heads/"${BRANCH}" -o yaml | yq4 '.result[] | select(.metadata.annotations[].key == "with-preview") | .name' | head -1)
done

job_url="https://werft.gitpod-dev.com/job/${BUILD_ID}"
echo "start build preview environment, job name: ${BUILD_ID}, job url: ${job_url}, this will take long time" | werft log slice "build preview environment"
werft log result -d "Build job for integration test branch" url "${job_url}"

while true; do
    set +e
    job_log=$(werft job get "${BUILD_ID}" -o json 2>&1)
    set -e
    if echo "$job_log" | grep -q "code = Unavailable"; then
        echo "Werft returned 50X for some reason. Waiting for ${BUILD_ID} to finish running. Sleeping 10 seconds." | werft log slice "build preview environment";
        sleep 10
    else
        job_phase=$(echo "$job_log" | jq --raw-output '.phase')
        if [[ ${job_phase} != "PHASE_DONE" ]]; then
            echo "Waiting for ${BUILD_ID} to finish running. Current phase: ${job_phase}. Sleeping 10 seconds." | werft log slice "build preview environment";
            sleep 10
        else
            echo "Phase reached ${job_phase}. continuing." | werft log slice "build preview environment";
            break
        fi
    fi
done

job_success="$(werft job get "${BUILD_ID}"  -o json | jq --raw-output '.conditions.success')"
if [[ ${job_success} == "null" ]]; then
    (
      echo "The build job for the preview environment failed." && \
      echo ""  && \
      echo "See the logs for the job here for details on why: ${job_url}" && \
      echo ""  && \
      echo "While this error is unrelated to our integration tests it does mean we can't continue as we don't have a target to run integration tests against without a working preview environment."  && \
      echo ""  && \
      echo "Marking this job as failed. Please retry the integration test job." && \
      echo "" \
    ) | werft log slice "build preview environment"
    werft log slice "build preview environment" --fail "Build job for preview environment failed"
    exit 1
fi

echo "build success" | werft log slice "build preview environment"
werft log slice "build preview environment" --done

werft log phase "kubectx" "kubectx"
mkdir -p /home/gitpod/.ssh
/workspace/dev/preview/util/download-and-merge-harvester-kubeconfig.sh | werft log slice "kubectx"
/workspace/dev/preview/install-k3s-kubeconfig.sh | werft log slice "kubectx"
werft log slice "kubectx" --done

werft log phase "integration test" "integration test"
args=()
args+=( "-kubeconfig=/home/gitpod/.kube/config" )
args+=( "-namespace=default" )
[[ "$USERNAME" != "" ]] && args+=( "-username=$USERNAME" )
args+=( "-timeout=60m" )

IDE_TESTS_DIR="/workspace/test/tests/ide"
JETBRAINS_TESTS="$IDE_TESTS_DIR/jetbrains"
VSCODE_TESTS="$IDE_TESTS_DIR/vscode"
SSH_TESTS="$IDE_TESTS_DIR/ssh"

IDE_TEST_LIST=("$SSH_TESTS $VSCODE_TESTS $JETBRAINS_TESTS")
for TEST_PATH in "${IDE_TEST_LIST[@]}"
do
    TEST_NAME=$(basename "${TEST_PATH}")
    echo "running integration for ${TEST_NAME}" | werft log slice "test-${TEST_NAME}"
    RUN_COUNT=$((RUN_COUNT+1))

    cd "${TEST_PATH}"
    set +e
    go test -v ./... "${args[@]}" 2>&1 | tee "${TEST_NAME}".log | werft log slice "test-${TEST_NAME}"
    RC=${PIPESTATUS[0]}
    set -e

    if [ "${RC}" -ne "0" ]; then
      FAILURE_COUNT=$((FAILURE_COUNT+1))
      FAILURE_TESTS["${TEST_NAME}"]=$(grep "\-\-\- FAIL: " "${TEST_PATH}"/"${TEST_NAME}".log)
      werft log slice "test-${TEST_NAME}" --fail "${RC}"
    else
      werft log slice "test-${TEST_NAME}" --done
    fi
done

exit $FAILURE_COUNT
