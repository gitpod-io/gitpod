#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

GO111MODULES=off go get -v github.com/grpc-ecosystem/grpc-gateway/protoc-gen-openapiv2
THIRD_PARTY_INCLUDES=${PROTOLOC:-..}
if [ ! -d $THIRD_PARTY_INCLUDES/third_party/google/api ]; then
    echo "missing $THIRD_PARTY_INCLUDES/third_party/google/api"
    exit -1
fi


mkdir -p lib
export PROTO_INCLUDE="-I$THIRD_PARTY_INCLUDES/third_party -I /usr/lib/protoc/include"

protoc $PROTO_INCLUDE --openapiv2_out=logtostderr=true:. -I${PROTOLOC:-..} ${PROTOLOC:-..}/*.proto && \
mv *.swagger.json lib && \
for f in $(ls lib/*.swagger.json); do 
    yarn dtsgen -o ${f%.swagger.json}.dt.ts $f
done