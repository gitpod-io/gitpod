#!/bin/sh

PROTOC_INCLUDE="-I. -I $GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis -I /usr/lib/protoc/include"

GO111MODULE=on  go get github.com/golang/protobuf/protoc-gen-go@v1.3.5 
GO111MODULE=off go get github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
protoc $PROTOC_INCLUDE --go_out=plugins=grpc:go *.proto
protoc $PROTOC_INCLUDE --grpc-gateway_out=allow_colon_final_segments=true,logtostderr=true,paths=source_relative:go *.proto
