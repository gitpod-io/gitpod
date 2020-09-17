package main

import "github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/protoc-gen-jsonrpcgw/generator"

func main() {
	g := generator.New()
	g.Generate()
}
