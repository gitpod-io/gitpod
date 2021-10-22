// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package runner

import (
	"os"
	"os/exec"
)

// ShellRun is a simple wrapper to run commands in shell
// and redirect Stdout and Stderr to OS's Stdout and Stderr
func ShellRunWithDefaultConfig(shellCmd string, shellArgs []string) error {
	cmd := exec.Command(shellCmd, shellArgs...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		return err
	}
	return err
}
