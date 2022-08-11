#!/usr/bin/env bash

set -euo pipefail

BRANCH="wk-inte-test/"$(date +%Y%m%d%H%M%S)
FAILURE_COUNT=0
RUN_COUNT=0
declare -A FAILURE_TESTS

context_name=$1
context_repo=$2

function cleanup ()
{
  werft log phase "slack notification" "slack notification"
  werftJobUrl="https://werft.gitpod-dev.com/job/${context_name}"

  if [ "${RUN_COUNT}" -eq "0" ]; then
    title=":x: *Workspace integration test fail*"
    title=$title"\n_Repo:_ ${context_repo}\n_Build:_ ${context_name}"

    errs="Failed at preparing the preview environment"
    BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
  elif [ "${FAILURE_COUNT}" -ne "0" ]; then
    title=":x: *Workspace integration test fail*"
    title=$title"\n_Repo:_ ${context_repo}\n_Build:_ ${context_name}"

    errs=""
    for TEST_NAME in ${!FAILURE_TESTS[*]}; do
      title=$title"\n_Tests_: ${TEST_NAME}"
      errs+="${FAILURE_TESTS["${TEST_NAME}"]}"
    done
    errs=$(echo "${errs}" | head)
    BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}},{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"\`\`\`\\n${errs}\\n\`\`\`\"}}]}"
  else
    title=":white_check_mark: *Workspace integration test pass*"

    title=$title"\n_Repo:_ ${context_repo}\n_Build:_ ${context_name}"
    BODY="{\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"${title}\"},\"accessory\":{\"type\":\"button\",\"text\":{\"type\":\"plain_text\",\"text\":\":werft: Go to Werft\",\"emoji\":true},\"value\":\"click_me_123\",\"url\":\"${werftJobUrl}\",\"action_id\":\"button-action\"}}]}"
  fi

  curl -X POST \
    -H 'Content-type: application/json' \
    -d "${BODY}" \
    "https://hooks.slack.com/${SLACK_NOTIFICATION_PATH}"
  werft log result "slack notification" "${PIPESTATUS[0]}"

  werft log phase "clean up" "clean up"
  git push origin :"${BRANCH}" | werft log slice "clean up"
  werft log slice "clean up" --done
}

sudo chown -R gitpod:gitpod /workspace
gcloud auth activate-service-account --key-file /mnt/secrets/gcp-sa/service-account.json
export GOOGLE_APPLICATION_CREDENTIALS="/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json"

git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io
git remote set-url origin https://oauth2:"${ROBOQUAT_TOKEN}"@github.com/gitpod-io/gitpod.git

werft log phase "build preview environment" "build preview environment"

# Create branch off main and ask Werft to create a preview environment for it
( \
    git checkout -B "${BRANCH}" && \
    echo "integration test" >> README.md && \
    git add README.md && \
    git commit -m "integration test"  && \
    git push --set-upstream origin "${BRANCH}" && \
    werft run github -a with-preview=true
) | werft log slice "build preview environment"

trap cleanup SIGINT SIGTERM EXIT

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
    job_phase=$(werft job get "${BUILD_ID}" -o json | jq --raw-output '.phase')
    if [[ ${job_phase} != "PHASE_DONE" ]]; then
        echo "Waiting for ${BUILD_ID} to finish running. Current phase: ${job_phase}. Sleeping 10 seconds." | werft log slice "build preview environment";
        sleep 10
    else
        echo "Phase reached ${job_phase}. continuing." | werft log slice "build preview environment";
        break
    fi
done

job_success="$(werft job get "${BUILD_ID}"  -o json | jq --raw-output '.conditions.success')"
if [[ ${job_success} == "null" ]]; then
    echo "build failed" | werft log slice "build preview environment"
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

WK_TEST_LIST=(/workspace/test/tests/components/content-service /workspace/test/tests/components/image-builder /workspace/test/tests/components/ws-daemon /workspace/test/tests/components/ws-manager /workspace/test/tests/workspace)
for TEST_PATH in "${WK_TEST_LIST[@]}"
do
    TEST_NAME=$(basename "${TEST_PATH}")
    echo "running integration for ${TEST_NAME}" | werft log slice "test-${TEST_NAME}"

    cd "${TEST_PATH}"
    set +e
    go test -v ./... "${args[@]}" 2>&1 | tee "${TEST_NAME}".log | werft log slice "test-${TEST_NAME}"
    RC=${PIPESTATUS[0]}
    set -e

    RUN_COUNT=$((RUN_COUNT+1))
    if [ "${RC}" -ne "0" ]; then
      FAILURE_COUNT=$((FAILURE_COUNT+1))
      FAILURE_TESTS["${TEST_NAME}"]=$(grep "\-\-\- FAIL: " "${TEST_PATH}"/"${TEST_NAME}".log)
      werft log slice "test-${TEST_NAME}" --fail "${RC}"
    else
      werft log slice "test-${TEST_NAME}" --done
    fi
done

exit $FAILURE_COUNT
