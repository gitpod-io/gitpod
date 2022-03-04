#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

export CGO_ENABLED=0

mkdir -p bin

for AGENT in pkg/agent/*; do
    echo "building agent $AGENT"
    base=$(basename "$AGENT")
    go build -trimpath -ldflags="-buildid= -w -s" -o bin/gitpod-integration-test-"${base%_agent}"-agent ./"$AGENT"
done

for COMPONENT in tests/components/*; do
    echo "building test $COMPONENT"
    OUTPUT=$(basename "$COMPONENT")
    go test -trimpath -ldflags="-buildid= -w -s" -c -o bin/"$OUTPUT".test ./"$COMPONENT"
done

echo "building test tests/workspace"
go test -trimpath -ldflags="-buildid= -w -s" -o bin/workspace.test -c ./tests/workspace

for COMPONENT in tests/ide/*; do
    echo "building test $COMPONENT"
    OUTPUT=$(basename "$COMPONENT")
    go test -trimpath -ldflags="-buildid= -w -s" -c -o bin/"$OUTPUT".test ./"$COMPONENT"
done
