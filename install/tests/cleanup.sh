#!/usr/bin/env bash
#
#

declare -g rc=0

cleanup() {
    TF_VAR_TEST_ID=$1
    cloud=$(echo "$TF_VAR_TEST_ID" | sed 's/\(.*\)-/\1 /' | xargs | awk '{print $2}')

    if [[ "$TF_VAR_TEST_ID" == gitpod-* ]] ; then echo "$TF_VAR_TEST_ID has the pattern gitpod-*, skipping"; return; fi
    if [[ "$TF_VAR_TEST_ID" == release-* ]] ; then echo "$TF_VAR_TEST_ID has the pattern gitpod-*, skipping"; return; fi

    if [ "$TF_VAR_TEST_ID" = "default" ] || [ "$TF_VAR_TEST_ID" = "" ]; then return; fi

    if [ -z "$cloud" ]; then cloud=cluster; fi

    echo "Cleaning up $TF_VAR_TEST_ID"

    export TF_VAR_TEST_ID=$TF_VAR_TEST_ID

    make cleanup cloud=$cloud
    (( rc |= $? ))

    CUSTOMERID=$(replicated customer ls --app "${REPLICATED_APP}" | grep "$TF_VAR_TEST_ID" | awk '{print $1}')

    [ -z "$CUSTOMERID" ] && return

    echo "Trying to archive replicated license"

    curl --request POST \
    --url "https://api.replicated.com/vendor/v3/customer/$CUSTOMERID/archive" \
    --header "Authorization: ${REPLICATED_API_TOKEN}" || echo "Couldn't delete replicated licese"
}

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then echo "Env var GOOGLE_APPLICATION_CREDENTIALS not set"; exit 1; fi

limit='10 hours ago'

gcloud auth activate-service-account --key-file="${GOOGLE_APPLICATION_CREDENTIALS}" --project=sh-automated-tests

if [ -n "${TF_VAR_TEST_ID}" ]; then cleanup "$TF_VAR_TEST_ID"; exit 0; else echo "Cleanup all old workspaces"; fi

for i in $(gsutil ls gs://nightly-tests/tf-state); do
    # we have to check if the file was created atleast 1 day ago
    datetime=$(gsutil ls -la "$i" | xargs |  awk '{print $2}')
    dtSec=$(date --date "$datetime" +'%s')
    dtOld=$(date --date "$limit" +'%s')
    if [ "$dtSec" -gt "$dtOld" ]; then echo "$i was not created atleast '$limit', skipping"; continue; fi

    filename=$(echo "$i" | rev | cut -d '/' -f 1 | rev)

    [ -z "$filename" ] && continue

    if [[ "$filename" == *-kubeconfig ]]; then continue; fi
    if [[ "$filename" == *-creds ]]; then continue; fi

    TF_VAR_TEST_ID=$(basename "$filename" .tfstate)

    cleanup "$TF_VAR_TEST_ID"

done

exit $rc
