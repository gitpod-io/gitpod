#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


mkdir -p bin

# shellcheck disable=SC2044
for i in $(find . -type d -name "*_agent"); do
    echo building agent "$i"
    base=$(basename "$i")
    CGO_ENABLED=0 go build -o bin/gitpod-integration-test-"${base%_agent}"-agent "$i"
done

# shellcheck disable=SC2045
for i in $(ls tests/); do
    echo building test "$i"
    CGO_ENABLED=0 go test -c ./tests/"$i"
    mv "$i".test bin
done
