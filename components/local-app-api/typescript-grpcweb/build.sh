#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

PROTO_DIR=${PROTOLOC:-$DIR/..}

if [ -d "$PROTO_DIR"/components-supervisor-api--proto ]; then
    mv "$PROTO_DIR"/components-supervisor-api--proto "$PROTOLOC"/supervisor-api
    COMPONENTS_DIR="$PROTO_DIR"
else
    COMPONENTS_DIR="$PROTO_DIR"/..
fi

THIRD_PARTY_INCLUDES=$COMPONENTS_DIR/supervisor-api/third_party
if [ ! -d "$THIRD_PARTY_INCLUDES"/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/google/api"
    exit 255
fi

mkdir -p lib

protoc \
    -I /usr/lib/protoc/include -I"$PROTO_DIR" -I"$COMPONENTS_DIR" -I"$THIRD_PARTY_INCLUDES" \
    --plugin="protoc-gen-ts=$DIR/node_modules/.bin/protoc-gen-ts" \
    --js_out="import_style=commonjs,binary:lib" \
    --ts_out="service=grpc-web:lib" \
    "$PROTO_DIR"/*.proto

sed -i 's/\.\/supervisor-api/\@gitpod\/supervisor-api-grpcweb\/lib/g' lib/*.js
sed -i 's/\.\/supervisor-api/\@gitpod\/supervisor-api-grpcweb\/lib/g' lib/*.d.ts
