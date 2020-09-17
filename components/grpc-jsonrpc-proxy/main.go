/*
Copyright © 2020 NAME HERE <EMAIL ADDRESS>

*/
package main

import (
	proxy "github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/cmd/proxy"

	_ "github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/pkg/example"
)

func main() {
	proxy.Execute()
}
