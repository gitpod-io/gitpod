#!/usr/bin/env bash
#
#
if [ -z "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then echo "Env var GOOGLE_APPLICATION_CREDENTIALS not set"; exit 1; fi


limit='10 hours ago'

gcloud auth activate-service-account --key-file="${GOOGLE_APPLICATION_CREDENTIALS}" --project=sh-automated-tests
for i in $(gsutil ls gs://nightly-tests/tf-state); do
    # we have to check if the file was created atleast 1 day ago
    datetime=$(gsutil ls -la "$i" | xargs |  awk '{print $2}')
    dtSec=$(date --date "$datetime" +'%s')
    dtOld=$(date --date "$limit" +'%s')
    if [ "$dtSec" -gt "$dtOld" ]; then echo "$i was not created atleast '$limit', skipping"; continue; fi

    filename=$(echo "$i" | rev | cut -d '/' -f 1 | rev)

    [ -z "$filename" ] && continue

    if [[ "$filename" == *-kubeconfig ]]; then continue; fi

    TF_VAR_TEST_ID=$(basename "$filename" .tfstate)

    cloud=$(echo "$TF_VAR_TEST_ID" | sed 's/\(.*\)-/\1 /' | xargs | awk '{print $2}')

    if [[ "$TF_VAR_TEST_ID" == gitpod-* ]] ; then echo "$TF_VAR_TEST_ID has the pattern gitpod-*, skipping"; continue; fi

    if [ "$TF_VAR_TEST_ID" = "default" ] || [ "$TF_VAR_TEST_ID" = "" ]; then continue; fi

    if [ -z "$cloud" ]; then cloud=cluster; fi

    echo "Cleaning up $TF_VAR_TEST_ID"

    export TF_VAR_TEST_ID=$TF_VAR_TEST_ID

    make cleanup cloud=$cloud
done
