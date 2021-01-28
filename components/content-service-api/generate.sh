#!/bin/sh

GO111MODULE=on go get github.com/golang/protobuf/protoc-gen-go@v1.3.5
protoc -I. --go_out=plugins=grpc:. *.proto
mv github.com/gitpod-io/gitpod/content-service/api/* go && rm -rf github.com

cd typescript
rm src/initializer_*.ts src/initializer_*.js src/blobs_*.ts src/blobs_*.js
export PATH=$(yarn bin):$PATH
protoc --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` --js_out=import_style=commonjs,binary:src --grpc_out=src -I.. ../*.proto
protoc --plugin=protoc-gen-ts=`which protoc-gen-ts` --ts_out=src -I /usr/lib/protoc/include -I .. ../*.proto
cd ..

go generate typescript/util/generate-ws-ready.go
