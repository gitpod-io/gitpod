#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

COMPONENT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ROOT_DIR=$COMPONENT_DIR/../../

# build protoc-gen-public-api
yarn --cwd "$COMPONENT_DIR/protoc-gen" build

# add bin/protoc-gen-public-api to PATH
export PATH="$COMPONENT_DIR/bin:$PATH"

# include protoc bash functions
# shellcheck disable=SC1090,SC1091
source "$ROOT_DIR"/scripts/protoc-generator.sh

pushd "go"
  go install github.com/gitpod-io/gitpod/components/public-api/go/protoc-proxy-gen
popd

install_dependencies

lint

# Format all proto files
buf format -w

# Run breaking change detector
buf breaking --against "https://github.com/gitpod-io/gitpod.git#branch=main,subdir=components/public-api"

# Remove generated files, so they are re-created
rm -rf go/experimental

protoc_buf_generate

update_license

# Run end-of-file-fixer
git ls-files -- 'typescript/*.ts' | xargs pre-commit run end-of-file-fixer --files

yarn --cwd typescript build
