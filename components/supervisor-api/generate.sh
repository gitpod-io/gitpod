#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd $(dirname "${BASH_SOURCE}") && pwd -P)/../..
COMPONENTS_DIR=$ROOT_DIR/components

# include protoc bash functions
source $ROOT_DIR/scripts/protoc-generator.sh

THIRD_PARTY_INCLUDES=${PROTOLOC:-$PWD/third_party}
if [ ! -d $THIRD_PARTY_INCLUDES/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/google/api"
    exit -1
fi

# TODO (aledbf): refactor to avoid duplication
local_go_protoc() {
    local ROOT_DIR=$1

    protoc \
        -I /usr/lib/protoc/include -I$COMPONENTS_DIR -I. -I$THIRD_PARTY_INCLUDES \
        --go_out=go \
        --go_opt=paths=source_relative \
        *.proto
}

go_protoc_gateway() {
    protoc \
        -I /usr/lib/protoc/include -I$COMPONENTS_DIR -I. -I$THIRD_PARTY_INCLUDES \
        --grpc-gateway_out=logtostderr=true,paths=source_relative:go \
        *.proto
}

install_dependencies
local_go_protoc $COMPONENTS_DIR
go_protoc_gateway $COMPONENTS_DIR
update_license
