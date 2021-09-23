//+build tools

// Package tools tracks dependencies for tools that used in the build process.
// See https://github.com/golang/go/wiki/Modules
package tools

import (
	_ "github.com/google/go-jsonnet/cmd/jsonnet"
	_ "github.com/google/go-jsonnet/cmd/jsonnetfmt"
	_ "github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb"
)