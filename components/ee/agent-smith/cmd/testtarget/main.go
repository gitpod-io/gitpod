// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"time"
)

func main() {
	time.Sleep(30 * time.Second)
	agentSmithTestTarget()
}

// don't inline to produce an elf entry
//
//go:noinline
func agentSmithTestTarget() {
	fmt.Println("something")
}
