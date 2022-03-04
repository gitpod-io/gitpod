// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

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
//go:noinline
func agentSmithTestTarget() {
	fmt.Println("something")
}
