// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"math/rand"
	"time"

	"github.com/gitpod-io/gitpod/autoscaler-expander/cmd"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	cmd.Execute()
}
