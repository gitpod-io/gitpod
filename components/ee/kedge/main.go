// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package main

import (
	"github.com/gitpod-io/gitpod/kedge/cmd"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
)

func main() {
	cmd.Execute()
}
