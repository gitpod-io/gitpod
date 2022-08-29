#!/usr/bin/env bash

set -euo pipefail

FAILURE_COUNT=0
RUN_COUNT=0
declare -A FAILURE_TESTS
declare SIGNAL # used to record signal caught by trap

context_name=$1
context_repo=$2

function cleanup ()
{
  werft log phase "slack notification and cleanup $SIGNAL" "Slack notification and cleanup: $SIGNAL"

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

  echo "Sending Slack notificaition" | werft log slice "slack notification"
  curl -X POST \
    -H 'Content-type: application/json' \
    -d "${BODY}" \
    "https://hooks.slack.com/${SLACK_NOTIFICATION_PATH}"
  werft log result "slack notification" "${PIPESTATUS[0]}"
  werft log slice "slack notification" --done

  echo "Finished cleaning up based on signal $SIGNAL" | werft log slice "clean up"
  werft log slice "clean up" --done
}

sudo chown -R gitpod:gitpod /workspace
gcloud auth activate-service-account --key-file /mnt/secrets/gcp-sa/service-account.json
export GOOGLE_APPLICATION_CREDENTIALS="/home/gitpod/.config/gcloud/legacy_credentials/cd-gitpod-deployer@gitpod-core-dev.iam.gserviceaccount.com/adc.json"

git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io
git remote set-url origin https://oauth2:"${ROBOQUAT_TOKEN}"@github.com/gitpod-io/gitpod.git

werft log phase "workspace-preview" "workspace-preview"

sudo curl -sSL https://github.com/go-acme/lego/releases/download/v4.5.3/lego_v4.5.3_linux_amd64.tar.gz | sudo tar -xvz -C /usr/local/bin
sudo install-packages netcat

git clone https://github.com/gitpod-io/workspace-preview
pushd workspace-preview
./new-vm.sh -v "${context_name}" | werft log slice "workspace-preview"
source ${PWD}/vm.env
popd

werft log slice "workspace-preview" --done

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
