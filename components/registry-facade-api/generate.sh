#!/bin/bash

set -e

GO111MODULE=on go get github.com/golang/protobuf/protoc-gen-go@v1.3.5
protoc -I. -I../../ --go_out=plugins=grpc:go imagespec.proto
protoc -I. -I../../ --go_out=plugins=grpc:go provider.proto
