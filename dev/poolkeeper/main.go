// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package main

import (
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"

	"github.com/gitpod-io/gitpod/poolkeeper/cmd"
)

func main() {
	cmd.Execute()
}
