#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd $(dirname "${BASH_SOURCE}") && pwd -P)/../../
COMPONENTS_DIR=$ROOT_DIR/components

# include protoc bash functions
source $ROOT_DIR/scripts/protoc-generator.sh

install_dependencies
go_protoc $COMPONENTS_DIR
typescript_protoc $COMPONENTS_DIR

go generate typescript/util/generate-ws-ready.go

update_license
