#!/usr/bin/env bash
#
# The easiest way to run this script is through Werft so you don't have to worry
# about installing the appropraite service account etc. locally.
#
#   werft job run github -j .werft/platform-trigger-artificial-job.yaml -s .werft/platform-trigger-artificial-job.sh
#

sleep 1

set -Eeuo pipefail

werft log phase "Trigger new job with-preview" "Trigger new job with preview environment"
sudo chown -R gitpod:gitpod /workspace
git config --global user.name roboquat
git config --global user.email roboquat@gitpod.io

BRANCH="platform-artificial-job-$(echo $RANDOM | md5sum | head -c 20; echo;)"
git checkout -b "$BRANCH" | werft log slice "Creating new branch"

BUILD_ID=$(werft run github -a with-preview=true)
job_url="https://werft.gitpod-dev.com/job/${BUILD_ID}"
echo "Triggered job $job_url" | werft log slice "Triggering new job"
werft log result -d "build job" url "$job_url"

set +e
while true; do
    job_phase=$(werft job get "${BUILD_ID}" -o json | jq --raw-output '.phase')
    if [[ ${job_phase} != "PHASE_DONE" ]]; then
        echo "Waiting for ${BUILD_ID} to finish running. Current phase: ${job_phase}. Sleeping 10 seconds." | werft log slice "Waiting for job completion";
        sleep 10
    else
        echo "Phase reached ${job_phase}. continuing." | werft log slice "Waiting for job completion";
        break
    fi
done
set -e

###########
# Deleting artificial preview
###########

werft log phase "Deleting artificial preview" "Deleting artificial preview"

PREVIEW_NAME=$(echo "$BRANCH" | awk '{ sub(/^refs\/heads\//, ""); $0 = tolower($0); gsub(/[^-a-z0-9]/, "-"); print }')
length=$(echo -n "$PREVIEW_NAME" | wc -c)

if [ "$length" -gt 20 ]; then
    hashed=$(echo -n "${PREVIEW_NAME}" | sha256sum)
    PREVIEW_NAME="${PREVIEW_NAME:0:10}${hashed:0:10}"
fi

DELETE_JOB_ID=$(werft run github -j .werft/platform-delete-preview-environment.yaml -a preview="$PREVIEW_NAME")
delete_job_url="https://werft.gitpod-dev.com/job/${DELETE_JOB_ID}"
echo "Triggered job $delete_job_url" | werft log slice "Triggering new deletion job"
werft log result -d "delete preview job" url "$delete_job_url"
