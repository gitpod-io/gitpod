#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

THIRD_PARTY_INCLUDES=${PROTOLOC:-$DIR/..}
if [ ! -d "$THIRD_PARTY_INCLUDES"/third_party/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/third_party/google/api"
    exit 1
fi


mkdir -p lib
export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party -I /usr/lib/protoc/include"

protoc -I"$THIRD_PARTY_INCLUDES"/third_party -I/usr/lib/protoc/include \
    --plugin="protoc-gen-ts=$DIR/node_modules/.bin/protoc-gen-ts" \
    --js_out="import_style=commonjs,binary:lib" \
    --ts_out="service=grpc-web:lib" \
    -I"${PROTOLOC:-..}" "${PROTOLOC:-..}"/*.proto

# shellcheck disable=SC2038
find lib -iname '*.js' -or -iname '*.ts' | xargs sed -i '\/google\/api\/annotations_pb/d'
# shellcheck disable=SC2038
find lib -iname '*.js' -or -iname '*.ts' | xargs sed -i '/google_api_annotations_pb/d'
