#!/bin/sh
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# exclude 'e' (exit on any error)
# there are many test binaries, each can have failures

test_pattern="*.test"
for i in "$@"; do
  case $i in
    -testPattern=*|--testPattern=*)
      test_pattern="${i#*=}"
      shift
      ;;
    *)
      ;;
  esac
done

export PATH="$PATH:/tests"

FAILURE_COUNT=0
# shellcheck disable=SC2045
for i in $(find /tests/ -name "$test_pattern" | sort); do
    echo "running test: $i"
    "$i" "$@" -test.v;
    TEST_STATUS=$?
    if [ "$TEST_STATUS" -ne "0" ]; then
        FAILURE_COUNT=$((FAILURE_COUNT+1))
        echo "Test failed at $(date)"
    else
        echo "Test succeeded at $(date)"
    fi;
done

if [ "$FAILURE_COUNT" -ne "0" ]; then
    # exit with the number of test binaries that failed
    echo "Test suite ended with failure at $(date)"
    exit $FAILURE_COUNT
fi;

echo "Test suite ended with success at $(date)"
