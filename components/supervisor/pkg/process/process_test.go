// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package process

import (
	"os"
	"os/exec"
	"testing"

	"github.com/prometheus/procfs"
	"github.com/stretchr/testify/require"
)

func TestVisitProcessTree(t *testing.T) {
	cmd := exec.Command("/bin/sleep", "1000")
	err := cmd.Start()
	require.NoError(t, err)
	expectation := []int{cmd.Process.Pid, os.Getpid()}
	visitedProcessIds := []int{}
	VisitProcessTree(os.Getpid(), func(process procfs.Proc) error {
		visitedProcessIds = append(visitedProcessIds, process.PID)
		return nil
	})
	require.Equal(t, expectation, visitedProcessIds)
}
