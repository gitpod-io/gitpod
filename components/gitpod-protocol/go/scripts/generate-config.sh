#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


COMPONENT_PATH="$(dirname "$0")/.."
echo "Component Path: ${COMPONENT_PATH}"

if [ "${LEEWAY_BUILD-}" == "true" ]; then
    CONFIG_PATH="./_deps/components-gitpod-protocol--gitpod-schema/gitpod-schema.json"
else
    CONFIG_PATH="$COMPONENT_PATH/../data/gitpod-schema.json"
fi
echo "Config Path: ${CONFIG_PATH}"

GITPOD_CONFIG_TYPE_PATH="$COMPONENT_PATH/gitpod-config-types.go"
echo "Config Types Path: ${GITPOD_CONFIG_TYPE_PATH}"
if [ "${LEEWAY_BUILD-}" == "true" ]; then
    git init -q
    git add "$GITPOD_CONFIG_TYPE_PATH"
fi

go install github.com/a-h/generate/...@latest

schema-generate -p protocol "$CONFIG_PATH" > "$GITPOD_CONFIG_TYPE_PATH"

sed -i 's/json:/yaml:/g' "$GITPOD_CONFIG_TYPE_PATH"
gofmt -w "$GITPOD_CONFIG_TYPE_PATH"

if [ "${LEEWAY_BUILD-}" == "true" ]; then
    ./_deps/dev-addlicense--app/addlicense "$GITPOD_CONFIG_TYPE_PATH"
else
    leeway run components:update-license-header
fi

git diff --exit-code "$GITPOD_CONFIG_TYPE_PATH"
