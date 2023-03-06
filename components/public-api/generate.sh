#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/../../

# include protoc bash functions
# shellcheck disable=SC1090,SC1091
source "$ROOT_DIR"/scripts/protoc-generator.sh

pushd "go"
  go install github.com/gitpod-io/gitpod/components/public-api/go/protoc-proxy-gen
popd

install_dependencies

lint

# Run breaking change detector
buf breaking --against "https://github.com/gitpod-io/gitpod.git#branch=main,subdir=components/public-api"

# Remove generated files, so they are re-created
rm -rf go/experimental

protoc_buf_generate

update_license
