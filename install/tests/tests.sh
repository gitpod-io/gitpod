#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# exclude 'e' (exit on any error)
# there are many test binaries, each can have failures

TEST_DIR="../../test/tests"

# shellcheck disable=SC2045
FAILURE_COUNT=0
CURRENT=$(pwd)
for i in $(find ${TEST_DIR} -type d -links 2 ! -empty | sort); do
    # Will print */ if no directories are available
    TEST_NAME=$(basename "${i}")
    echo "running integration for ${TEST_NAME}"

    cd "${i}" || echo "Path invalid for ${TEST_NAME}"
    go test -v ./... "-kubeconfig=$1" -namespace=gitpod -username=gitpod-integration-test 2>&0
    TEST_STATUS=$?
    if [ "$TEST_STATUS" -ne "0" ]; then
        FAILURE_COUNT=$((FAILURE_COUNT+1))
        echo "Test failed at $(date)"
    else
        echo "Test succeeded at $(date)"
    fi;

    cd "${CURRENT}" || echo "Couldn't move back to test dir"
done

if [ "$FAILURE_COUNT" -ne "0" ]; then
    echo "Test suite ended with failure at $(date)"
    exit $FAILURE_COUNT
fi;

echo "Test suite ended with success at $(date)"
