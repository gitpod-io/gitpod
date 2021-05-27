#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/../../
COMPONENTS_DIR=$ROOT_DIR/components

# include protoc bash functions
# shellcheck disable=SC1090,SC1091
source "$ROOT_DIR"/scripts/protoc-generator.sh

install_dependencies
go_protoc "$COMPONENTS_DIR"
typescript_protoc "$COMPONENTS_DIR"

go generate typescript/util/generate-ws-ready.go

# cd go
pushd go

mockgen \
    -package mock \
    github.com/gitpod-io/gitpod/image-builder/api ImageBuilderClient,ImageBuilder_BuildClient,ImageBuilder_LogsClient,ImageBuilderServer,ImageBuilder_BuildServer,ImageBuilder_LogsServer > mock/mock.go

# return to previous directory
popd

pushd typescript/src
node "$COMPONENTS_DIR"/content-service-api/typescript/patch-grpc-js.ts
popd

update_license
