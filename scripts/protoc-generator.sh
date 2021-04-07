#!/bin/bash

install_dependencies() {
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.26.0

    go get google.golang.org/protobuf/runtime/protoimpl@v1.26.0
    go get google.golang.org/protobuf/reflect/protoreflect@v1.26.0
	go get google.golang.org/protobuf/types/known/timestamppb@v1.26.0

    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.1.0

    go get github.com/golang/mock/mockgen@v1.5.0

    go get github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.2.0
}

go_protoc() {
    local ROOT_DIR=$1

    protoc \
        -I /usr/lib/protoc/include -I$ROOT_DIR -I. \
        --go_out=go \
        --go_opt=paths=source_relative \
        --go-grpc_out=go \
        --go-grpc_opt=paths=source_relative \
        *.proto
}

typescript_protoc() {
    local ROOT_DIR=$1
    local MODULE_DIR=$(pwd)

    pushd typescript > /dev/null

    yarn add grpc_tools_node_protoc_ts@5.1.3 -d

    rm -rf $MODULE_DIR/typescript/src/*pb*.*

    protoc \
        --plugin=protoc-gen-grpc=$MODULE_DIR/typescript/node_modules/.bin/grpc_tools_node_protoc_plugin \
        --js_out=import_style=commonjs,binary:src \
        --grpc_out=src \
        -I /usr/lib/protoc/include -I$ROOT_DIR -I. -I$MODULE_DIR \
        $MODULE_DIR/*.proto

    protoc \
        --plugin=protoc-gen-ts=$MODULE_DIR/typescript/node_modules/.bin/protoc-gen-ts \
        --ts_out=src \
        -I /usr/lib/protoc/include -I$ROOT_DIR -I. -I$MODULE_DIR \
        $MODULE_DIR/*.proto

    popd > /dev/null
}

update_license() {
    leeway run components:update-license-header
}
