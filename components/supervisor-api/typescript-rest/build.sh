#!/bin/bash

GO111MODULES=off go get github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger
THIRD_PARTY_INCLUDES=${PROTOLOC:-$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway}
if [ ! -d $THIRD_PARTY_INCLUDES/third_party/googleapis ]; then
    tmpdir=$(mktemp -d)
    git clone https://github.com/grpc-ecosystem/grpc-gateway $tmpdir
    THIRD_PARTY_INCLUDES=$tmpdir
fi

mkdir -p lib
export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party/googleapis -I /usr/lib/protoc/include"

protoc $PROTO_INCLUDE --swagger_out=logtostderr=true:. -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto && \
mv *.swagger.json lib && \
for f in $(ls lib/*.swagger.json); do 
    yarn dtsgen -o ${f%.swagger.json}.dt.ts $f
done