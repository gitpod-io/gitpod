#!/bin/bash

THIRD_PARTY_INCLUDES=${PROTOLOC:-$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway}
if [ ! -d $THIRD_PARTY_INCLUDES/third_party/googleapis ]; then
    tmpdir=$(mktemp -d)
    git clone https://github.com/grpc-ecosystem/grpc-gateway $tmpdir
    THIRD_PARTY_INCLUDES=$tmpdir
fi

mkdir -p lib
export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party/googleapis -I /usr/lib/protoc/include"

protoc $PROTO_INCLUDE --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` --js_out=import_style=commonjs,binary:lib --grpc_out=grpc_js:lib -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto && \
protoc $PROTO_INCLUDE --plugin=protoc-gen-ts=`which protoc-gen-ts` --ts_out=grpc_js:lib -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto                                                               && \
sed -i '/google_api_annotations_pb/d' lib/*.js