#!/bin/sh
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


go get github.com/golang/protobuf/protoc-gen-go
protoc -I. -I../../../ --go_out=plugins=grpc:. protocol.proto
