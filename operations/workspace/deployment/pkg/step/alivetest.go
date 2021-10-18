// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"fmt"
	"os/exec"

	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// AliveTestStep is the step which tests if the cluster is alive
type AliveTestStep struct {
	ProjectContext *common.ProjectContext
	ClusterContext *common.ClusterContext
	Cluster        *common.WorkspaceCluster
	// No prerun checks required to run test
}

// Fill this to trigger Dead or Alive test
func (js *AliveTestStep) Run() error {
	commandToRun := fmt.Sprintf("go test")

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	panic("I am not implemented yet!")
}
