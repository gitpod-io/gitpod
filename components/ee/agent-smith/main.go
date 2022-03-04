// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

//go:build !sentinel
// +build !sentinel

package main

import (
	"github.com/gitpod-io/gitpod/agent-smith/cmd"
)

func main() {
	cmd.Execute()
}
