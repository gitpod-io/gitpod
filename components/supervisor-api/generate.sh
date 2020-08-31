#!/bin/sh

PROTOC_INCLUDE="-I. -I $GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis -I /usr/lib/protoc/include"

GO111MODULE=on  go get github.com/golang/protobuf/protoc-gen-go@v1.3.5 
GO111MODULE=off go get github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
protoc $PROTOC_INCLUDE --go_out=plugins=grpc:go supervisor.proto
protoc $PROTOC_INCLUDE --grpc-gateway_out=logtostderr=true,paths=source_relative:go supervisor.proto

# GO111MODULE=on go get github.com/golang/mock/mockgen@latest
# cd go
# # source mode does not always work for gRPC: see https://github.com/golang/mock/pull/163
# mockgen -package mock github.com/gitpod-io/gitpod/ws-manager/api WorkspaceManagerClient,WorkspaceManager_SubscribeClient > mock/mock.go
# cd ..

# generate typescript client
cd typescript
# rm src/core_*.ts src/core_*.js
export PATH=$PWD/../../../../node_modules/.bin:$PATH
protoc $PROTOC_INCLUDE --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` --js_out=import_style=commonjs,binary:src --grpc_out=src -I.. ../supervisor.proto
protoc $PROTOC_INCLUDE --plugin=protoc-gen-ts=`which protoc-gen-ts` --ts_out=src -I.. ../supervisor.proto
cd ..