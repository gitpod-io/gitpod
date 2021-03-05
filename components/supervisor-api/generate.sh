#!/bin/sh

THIRD_PARTY_INCLUDES=${PROTOLOC:-.}
if [ ! -d $THIRD_PARTY_INCLUDES/third_party/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/third_party/google/api"
    exit -1
fi

export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party -I /usr/lib/protoc/include"

go get github.com/golang/protobuf/protoc-gen-go
GO111MODULE=off go get github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
protoc -I. $PROTO_INCLUDE --go_out=plugins=grpc:go *.proto
protoc -I. $PROTO_INCLUDE --grpc-gateway_out=logtostderr=true,paths=source_relative:go *.proto
leeway run components:update-license-header