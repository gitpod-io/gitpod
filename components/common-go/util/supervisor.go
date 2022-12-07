// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package util

import (
	"fmt"
	"os"
)

const (
	// SupervisorPort defines the supervisor listen port
	SupervisorPort = 22999
)

// SupervisorAddress return the <host>:<port> pair for supervisor.
// Custom values can be defined using the environment variable SUPERVISOR_ADDR.
func GetSupervisorAddress() string {
	addr := os.Getenv("SUPERVISOR_ADDR")
	if addr == "" {
		addr = fmt.Sprintf("127.0.0.1:%v", SupervisorPort)
	}

	return addr
}
