#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

CURRENT=$(pwd)
TESTPATH="../../$2"
DATE_BIN=$(command -v date)
DATE=$(${DATE_BIN} +%y-%m-%d--%H:%M:%S)

echo "Starting test on ${DATE} for ${TESTPATH}"

cd "${TESTPATH}" ||  echo "Path invalid ${TESTPATH}"

go test -timeout 30m -v ./... "-kubeconfig=$1" -namespace=gitpod -username=gitpod-integration-test 2>&0 -coverprofile=coverage.out

TEST_STATUS=$?
echo ${TEST_STATUS}
if [ "$TEST_STATUS" -ne "0" ]; then
    echo "Test failed for ${TESTPATH} at ${DATE}"
    exit 1
else
    echo "Test succeeded for ${TESTPATH} at ${DATE}"
    exit 0
fi;

cd "${CURRENT}" || echo "Couldn't move back to test dir"
