#!/bin/bash

COMPONENT_PATH="$(dirname "$0")/.."
GITPOD_CONFIG_TYPE_PATH="$COMPONENT_PATH/go/gitpod-config-types.go"

go install github.com/a-h/generate/...@latest

schema-generate -p protocol "$COMPONENT_PATH/data/gitpod-schema.json" > "$GITPOD_CONFIG_TYPE_PATH"

sed -i 's/json:/yaml:/g' "$GITPOD_CONFIG_TYPE_PATH"
gofmt -w "$GITPOD_CONFIG_TYPE_PATH"

leeway run components:update-license-header
