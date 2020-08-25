// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/gitpod/gitpod-cli/cmd"
)

var (
	// VERSION is set during build
	VERSION = "0.0.1"
)

func main() {
	cmd.Execute()
}
