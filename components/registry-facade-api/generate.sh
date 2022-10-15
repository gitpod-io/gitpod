#!/bin/bash

if [ -n "$DEBUG" ]; then
  set -x
fi

set -o errexit
set -o nounset
set -o pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/../../
COMPONENTS_DIR="$ROOT_DIR"/components

# include protoc bash functions
# shellcheck disable=SC1090,SC1091
source "$ROOT_DIR"/scripts/protoc-generator.sh

install_dependencies
go_protoc "$COMPONENTS_DIR"
update_license
