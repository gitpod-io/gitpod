#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/../..
COMPONENTS_DIR=$ROOT_DIR/components

# include protoc bash functions
# shellcheck disable=SC1090,SC1091
source "$ROOT_DIR"/scripts/protoc-generator.sh

THIRD_PARTY_INCLUDES=${PROTOLOC:-$PWD/third_party}
if [ ! -d "$THIRD_PARTY_INCLUDES"/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/google/api"
    exit 1
fi

# TODO (aledbf): refactor to avoid duplication
local_go_protoc() {
    local ROOT_DIR=$1
    # shellcheck disable=2035
    protoc \
        -I/usr/lib/protoc/include -I"$COMPONENTS_DIR" -I. -I"$THIRD_PARTY_INCLUDES" \
        --go_out=go \
        --go_opt=paths=source_relative \
        --go-grpc_out=go \
        --go-grpc_opt=paths=source_relative \
        *.proto
}

go_protoc_gateway() {
    # shellcheck disable=2035
    protoc \
        -I/usr/lib/protoc/include -I"$COMPONENTS_DIR" -I. -I"$THIRD_PARTY_INCLUDES" \
        --grpc-gateway_out=logtostderr=true,paths=source_relative:go \
        *.proto
}

local_java_protoc() {
    # replace Java reserved keywords
    sed -i 's/private = 0;/private_visibility = 0;/g' status.proto
    sed -i 's/public = 1;/public_visibility = 1;/g' status.proto
    protoc \
        -I /usr/lib/protoc/include -I"$COMPONENTS_DIR" -I. -I"$THIRD_PARTY_INCLUDES" \
        --plugin=protoc-gen-grpc-java=/tmp/protoc-gen-grpc-java \
        --grpc-java_out=java/src/main/java \
        --java_out=java/src/main/java \
        ./*.proto
    # revert Java reserved keywords
    sed -i 's/private_visibility = 0;/private = 0;/g' status.proto
    sed -i 's/public_visibility = 1;/public = 1;/g' status.proto
}

install_dependencies
local_go_protoc "$COMPONENTS_DIR"
go_protoc_gateway "$COMPONENTS_DIR"
local_java_protoc "$COMPONENTS_DIR"
update_license
