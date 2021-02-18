#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


THIRD_PARTY_INCLUDES=${PROTOLOC:-..}
if [ ! -d $THIRD_PARTY_INCLUDES/third_party/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/third_party/google/api"
    exit -1
fi

mkdir -p lib
export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party -I /usr/lib/protoc/include"

protoc $PROTO_INCLUDE --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` --js_out=import_style=commonjs,binary:lib --grpc_out=grpc_js:lib -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto && \
protoc $PROTO_INCLUDE --plugin=protoc-gen-ts=`which protoc-gen-ts` --ts_out=grpc_js:lib -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto                                                               && \
sed -i '/google_api_annotations_pb/d' lib/*.js