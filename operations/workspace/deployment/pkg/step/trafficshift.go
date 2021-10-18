// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"fmt"
	"os/exec"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// TrafficShiftStep is the step which tests if the cluster is alive
type TrafficShiftStep struct {
	ProjectContext   *common.ProjectContext
	ClusterContext   *common.ClusterContext
	WorkspaceCluster *common.WorkspaceCluster
	MetaCluster      *common.MetaCluster
	PreRuns          *prerun.TrafficShiftPreruns
}

// Fill this to trigger traffic shift to a cluster
func (js *TrafficShiftStep) Run() error {
	commandToRun := fmt.Sprintf("werft run shift-traffic")

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	panic("I am not implemented yet!")
}
