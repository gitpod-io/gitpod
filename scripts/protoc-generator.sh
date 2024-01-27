#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.


install_dependencies() {
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1

    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2.0

    go install github.com/golang/mock/mockgen@v1.6.0

    go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.11.3

    # To use buf as a codegeneration utility for protobuf plugins and linting
    go install github.com/bufbuild/buf/cmd/buf@v1.8.0

    # To generate connect-go (https://github.com/bufbuild/connect-go) interfaces
    go install github.com/bufbuild/connect-go/cmd/protoc-gen-connect-go@v1.0.0

    curl -sSo /tmp/protoc-gen-grpc-java https://repo1.maven.org/maven2/io/grpc/protoc-gen-grpc-java/1.49.0/protoc-gen-grpc-java-1.49.0-linux-x86_64.exe
    chmod +x /tmp/protoc-gen-grpc-java
}

lint() {
    buf lint || exit 1
}

protoc_buf_generate() {
    buf generate || exit 1
}

go_protoc() {
    local ROOT_DIR=$1
    local PROTO_DIR=${2:-.}
    # shellcheck disable=2035
    protoc \
        -I /usr/lib/protoc/include -I"$ROOT_DIR" -I. \
        --go_out=go \
        --go_opt=paths=source_relative \
        --go-grpc_out=go \
        --go-grpc_opt=paths=source_relative \
        "${PROTO_DIR}"/*.proto
}

typescript_ts_protoc() {
    local ROOT_DIR=$1
    local PROTO_DIR=${2:-.}
    local MODULE_DIR
    # Assigning external program output directly
    # after the `local` keyword masks the return value (Could be an error).
    # Should be done in a separate line.
    MODULE_DIR=$(pwd)
    TARGET_DIR="$MODULE_DIR"/typescript/src

    pushd typescript > /dev/null || exit

    yarn install

    rm -rf "$TARGET_DIR"
    mkdir -p "$TARGET_DIR"

    echo "[protoc] Generating TypeScript files"
    protoc --plugin="$MODULE_DIR"/typescript/node_modules/.bin/protoc-gen-ts_proto \
            --ts_proto_opt=context=true \
            --ts_proto_opt=lowerCaseServiceMethods=true \
            --ts_proto_opt=stringEnums=true \
            --ts_proto_out="$TARGET_DIR" \
            --ts_proto_opt=fileSuffix=.pb \
            --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false \
            -I /usr/lib/protoc/include -I"$ROOT_DIR" -I.. -I"../$PROTO_DIR" \
            "../$PROTO_DIR"/*.proto

popd > /dev/null || exit
}

typescript_protoc() {
    local ROOT_DIR=$1
    local PROTO_DIR=${2:-.}
    local MODULE_DIR
    # Assigning external program output directly
    # after the `local` keyword masks the return value (Could be an error).
    # Should be done in a separate line.
    MODULE_DIR=$(pwd)

    pushd typescript > /dev/null || exit

    yarn install

    rm -rf "$MODULE_DIR"/typescript/src/*pb*.*

    echo "[protoc] Generating TypeScript files"
    protoc \
        --plugin=protoc-gen-grpc="$MODULE_DIR"/typescript/node_modules/.bin/grpc_tools_node_protoc_plugin \
        --js_out=import_style=commonjs,binary:src \
        --grpc_out=grpc_js:src \
        -I /usr/lib/protoc/include -I"$ROOT_DIR" -I.. -I"../$PROTO_DIR" \
        "../$PROTO_DIR"/*.proto

    protoc \
        --plugin=protoc-gen-ts="$MODULE_DIR"/typescript/node_modules/.bin/protoc-gen-ts \
        --ts_out=grpc_js:src \
        -I /usr/lib/protoc/include -I"$ROOT_DIR" -I.. -I"../$PROTO_DIR" \
        "../$PROTO_DIR"/*.proto

    # remove trailing spaces
    find "$MODULE_DIR"/typescript/src -maxdepth 1 -name "*_pb.d.ts" -exec sed -i -e "s/[[:space:]]*$//" {} \;

    popd > /dev/null || exit
}

update_license() {
    leeway run components:update-license-header
}
