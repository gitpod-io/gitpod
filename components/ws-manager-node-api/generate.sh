#!/bin/sh

GO111MODULE=on go get github.com/golang/protobuf/protoc-gen-go@v1.3.5
protoc -I. -I.. --go_out=plugins=grpc:. *.proto
mv github.com/gitpod-io/gitpod/ws-manager-node/api/* go && rm -rf github.com

# GO111MODULE=on go get github.com/golang/mock/mockgen@latest
# cd go
# mockgen -package mock -source=wssync.pb.go > mock/mock_wssync.go
