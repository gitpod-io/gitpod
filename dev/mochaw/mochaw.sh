#!/bin/bash
# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.


COMPONENT_DIR="$(pwd)"

# unit or db
TEST_SUITE=${1:-unit}

FILE_PATTERN="**/*.spec.js"
if [ "$TEST_SUITE" = "db" ]; then
    FILE_PATTERN="**/*.spec.db.js"
fi

# Exclude the first argument and pass the rest to mocha
shift 1

if [ "$COVERAGE" = "true" ]; then
    nyc --cwd=/workspace/gitpod \
        --all \
        --report-dir="$COMPONENT_DIR/coverage/$TEST_SUITE" \
        --include="components/*/{src,lib,dist}/**/*.{ts,js}" \
        --include="components/public-api/typescript-common/src/**/*.ts" \
        --exclude="components/**/*.spec.{ts,js}" \
        --exclude="components/**/*.spec.db.{ts,js}" \
        --exclude="components/*/src/test/**" \
        --exclude="components/dashboard/**" \
        --exclude="components/supervisor/frontend/**" \
        --reporter=json \
        mocha "$COMPONENT_DIR/$FILE_PATTERN" --exclude "$COMPONENT_DIR/node_modules/**" --exclude "$COMPONENT_DIR/lib/esm/**" --exit "$@"
else
    mocha "$COMPONENT_DIR/$FILE_PATTERN" --exclude "$COMPONENT_DIR/node_modules/**" --exclude "$COMPONENT_DIR/lib/esm/**" --exit "$@"
fi
