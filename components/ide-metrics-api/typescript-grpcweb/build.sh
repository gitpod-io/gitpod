#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

curl -LsSo /tmp/protoc-gen-grpc-web https://github.com/grpc/grpc-web/releases/download/1.3.1/protoc-gen-grpc-web-1.3.1-linux-x86_64
    chmod +x /tmp/protoc-gen-grpc-web

THIRD_PARTY_INCLUDES="${PROTOLOC:-..}"
if [ ! -d "$THIRD_PARTY_INCLUDES"/third_party/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/third_party/google/api"
    exit 1
fi

mkdir -p lib

protoc -I"$THIRD_PARTY_INCLUDES"/third_party -I/usr/lib/protoc/include \
    --plugin=protoc-gen-grpc-web=/tmp/protoc-gen-grpc-web \
    --js_out=import_style=commonjs:lib \
    --grpc-web_out=import_style=commonjs+dts,mode=grpcweb:lib \
    -I"${PROTOLOC:-..}" "${PROTOLOC:-..}"/*.proto

# shellcheck disable=SC2038
find lib -iname '*.js' -or -iname '*.ts' | xargs sed -i '\/google\/api\/annotations_pb/d'
# shellcheck disable=SC2038
find lib -iname '*.js' -or -iname '*.ts' | xargs sed -i '/google_api_annotations_pb/d'
