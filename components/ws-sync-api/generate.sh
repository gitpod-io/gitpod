#!/bin/sh

GO111MODULE=on go get github.com/golang/protobuf/protoc-gen-go@v1.3.5
protoc -I. -I.. --go_out=plugins=grpc:. *.proto
mv github.com/gitpod-io/gitpod/ws-sync/api/* go && rm -rf github.com

GO111MODULE=on go get github.com/golang/mock/mockgen@latest
cd go
mockgen -package mock -source=wssync.pb.go > mock/mock_wssync.go


echo "updating JSON tags"
go get github.com/fatih/gomodifytags
# remove depreated json tags
gomodifytags -line 0,$(cat wssync.pb.go|wc -l) -file wssync.pb.go -remove-tags json -w >/dev/null
# add new JSON tags
gomodifytags -line 0,$(cat wssync.pb.go|wc -l) -file wssync.pb.go -add-tags json -transform camelcase -add-options json=omitempty -w >/dev/null
# remove JSON tags for XXX_
for line in $(grep -n xxx wssync.pb.go | cut -f1 -d: | paste -sd " " -); do
    gomodifytags -line $line -file wssync.pb.go -remove-tags json -w >/dev/null
    gomodifytags -line $line -file wssync.pb.go -add-tags json:"-" -w >/dev/null
done
cd ..

export PATH=$PWD/../../node_modules/.bin:$PATH
protoc --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` --js_out=import_style=commonjs,binary:typescript/src --grpc_out=typescript/src -I.. -I. *.proto
protoc --plugin=protoc-gen-ts=`which protoc-gen-ts` --ts_out=typescript/src -I /usr/lib/protoc/include -I.. -I. *.proto

cd typescript/src
node ../../../content-service-api/typescript/patch-grpc-js.ts
cd -