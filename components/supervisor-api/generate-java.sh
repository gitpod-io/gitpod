#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

# replace Java reserved keywords
sed -i 's/private = 0;/private_visibility = 0;/g' status.proto
sed -i 's/public = 1;/public_visibility = 1;/g' status.proto

PROTOC_GEN_GRPC_JAVA_PATH=/tmp/protoc-gen-grpc-java

if [ ! -f $PROTOC_GEN_GRPC_JAVA_PATH ]; then
    curl -sSo $PROTOC_GEN_GRPC_JAVA_PATH https://repo1.maven.org/maven2/io/grpc/protoc-gen-grpc-java/1.49.0/protoc-gen-grpc-java-1.49.0-linux-x86_64.exe
    chmod +x $PROTOC_GEN_GRPC_JAVA_PATH
fi

OUT_DIR=java/src/main/java/

mkdir -p $OUT_DIR

protoc \
    -I. -Ithird_party \
    --plugin=protoc-gen-grpc-java=$PROTOC_GEN_GRPC_JAVA_PATH \
    --grpc-java_out=$OUT_DIR \
    --java_out=$OUT_DIR \
    ./*.proto

# revert Java reserved keywords
sed -i 's/private_visibility = 0;/private = 0;/g' status.proto
sed -i 's/public_visibility = 1;/public = 1;/g' status.proto
