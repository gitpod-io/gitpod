#!/usr/bin/env bash

set -euo pipefail

TEMP_COMMIT_MSG="integration test"
# TODO(toru): Fix weird repeat running behavior
# https://github.com/gitpod-io/gitpod/issues/12795
LAST_COMMIT_MSG=$(git log --pretty=format:"%s" -1)
if [[ $LAST_COMMIT_MSG == "$TEMP_COMMIT_MSG" ]]; then exit 0; fi

BRANCH="wk-inte-test/"$(date +%Y%m%d%H%M%S)
FAILURE_COUNT=0
RUN_COUNT=0 # Prevent multiple cleanup runs
DO_CLEANUP=0
REVISION=""
FAILURE_TESTS=""
declare SIGNAL # used to record signal caught by trap

BRANCH_TIMEOUT_SEC=10800

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
        title=":x: *Workspace integration test fail*"
        title=$title"\n_Repo:_ ${context_repo}\n_Revision:_ ${REVISION}\n_Build:_ ${context_name}"

        errs="Failed at preparing the preview environment"
        BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
    elif [ "${FAILURE_COUNT}" -ne "0" ]; then
        title=":x: *Workspace integration test fail*"
        title=$title"\n_Repo:_ ${context_repo}\n_Revision:_ ${REVISION}\n_Build:_ ${context_name}"

        errs=$(echo "${FAILURE_TESTS}" | head)
        BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
    else
        title=":white_check_mark: *Workspace integration test pass*"

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

function gc_integration_branches ()
{
    werft log phase "GC too old integration branches" "GC too old integration branches"
    now=$(date --utc +%s)
    for br in $(git branch --format="%(refname:short)" -a | grep -v HEAD); do
        if echo "$br" | grep -q "origin/wk-inte-test/*"; then
            last_commite_date=$(date --utc --date "$(git show --format="%ci" "$br" | head -n 1)" +%s)
            diff=$(( now-last_commite_date ))
            if [[ $diff > $BRANCH_TIMEOUT_SEC ]]; then
                local_branch_name=$(echo "$br" | cut -d '/' -f2-)
                werft log slice "delete $local_branch_name"
                set +e
                git push origin :"$local_branch_name"
                set -e
                werft log slice "delete $local_branch_name" --done
            fi
        fi
    done
}

sudo chown -R gitpod:gitpod /workspace
gcloud auth activate-service-account --key-file /mnt/secrets/gcp-sa/service-account.json
export GOOGLE_APPLICATION_CREDENTIALS="/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json"

git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io
git remote set-url origin https://oauth2:"${ROBOQUAT_TOKEN}"@github.com/gitpod-io/gitpod.git

gc_integration_branches

werft log phase "Configure access" "Configure access"
mkdir -p /home/gitpod/.ssh

leeway run dev/preview/previewctl:install | werft log slice "install previewctl"
werft log slice "install previewctl" --done

echo "Configuring dev and harvester access" | werft log slice "configure kubeconfig"
previewctl get-credentials --gcp-service-account /mnt/secrets/gcp-sa/service-account.json | werft log slice "configure kubeconfig"
echo "Done" | werft log slice "configure kubeconfig"
werft log slice "configure kubeconfig" --done

werft log phase "build preview environment" "build preview environment"

REVISION=$(git show -s --format="%h" HEAD)

# Create a new branch and asks Werft to create a preview environment for it
( \
    git checkout -B "${BRANCH}" && \
    git commit -m "${TEMP_COMMIT_MSG}" --allow-empty  && \
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

echo "Configuring access to preview environment (k3s)" | werft log slice "configure k3s kubeconfig"
previewctl install-context --gcp-service-account /mnt/secrets/gcp-sa/service-account.json | werft log slice "configure k3s kubeconfig"
echo "Done" | werft log slice "configure k3s kubeconfig"
werft log slice "configure k3s kubeconfig" --done

werft log phase "integration test" "integration test"
TEST_DIR=$(basename "/workspace/test/")
cd "${TEST_DIR}"
werft log slice "running integration test"
export INTEGRATION_TEST_USERNAME="$USERNAME"
export INTEGRATION_TEST_USER_TOKEN="$USER_TOKEN"
set +e
KUBECONFIG=/home/gitpod/.kube/config GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json ./run.sh workspace | tee test-result.log
RC=${PIPESTATUS[0]}
set -e
RUN_COUNT=1
FAILURE_COUNT="$RC"

if [ "${RC}" -ne "0" ]; then
    FAILURE_TESTS=$(grep "\-\-\- FAIL: " test-result.log)
    werft log slice "running integration test" --fail "${RC}"
else
    werft log slice "running integration test" --done
fi

exit "${RC}"
