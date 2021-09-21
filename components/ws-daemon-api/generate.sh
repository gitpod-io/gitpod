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
typescript_protoc "$COMPONENTS_DIR"

# cd go
pushd go

mockgen \
    -package mock \
    github.com/gitpod-io/gitpod/ws-daemon/api WorkspaceContentServiceClient,WorkspaceContentServiceServer,InWorkspaceServiceClient > mock/mock.go

# NOTE: must manually embed the Unimplemented struct as mockgen cannot do so
sed -i '/\trecorder \*MockWorkspaceContentServiceServerMockRecorde/a \\tapi.UnimplementedWorkspaceContentServiceServer' mock/mock.go

echo "updating JSON tags"
go install github.com/fatih/gomodifytags
# remove depreated json tags
# shellcheck disable=SC2002
gomodifytags -line 0,"$(cat daemon.pb.go|wc -l)" -file daemon.pb.go -remove-tags json -w >/dev/null
# add new JSON tags
# shellcheck disable=SC2002
gomodifytags -line 0,"$(cat daemon.pb.go|wc -l)" -file daemon.pb.go -add-tags json -transform camelcase -add-options json=omitempty -w >/dev/null
# remove JSON tags for XXX_
for line in $(grep -n xxx daemon.pb.go | cut -f1 -d: | paste -sd " " -); do
    gomodifytags -line "$line" -file daemon.pb.go -remove-tags json -w >/dev/null
    gomodifytags -line "$line" -file daemon.pb.go -add-tags json:"-" -w >/dev/null
done

# return to previous directory
popd

pushd typescript/src
node "$COMPONENTS_DIR"/content-service-api/typescript/patch-grpc-js.ts
popd

update_license
