package step

import (
	"fmt"
	"os/exec"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// RegisterClusterStep is the step which registers workspace cluster to Meta clusters
type RegisterClusterStep struct {
	ProjectContext   *common.ProjectContext
	ClusterContext   *common.ClusterContext
	WorkspaceCluster *common.WorkspaceCluster
	MetaCluster      *common.MetaCluster
	PreRuns          *prerun.RegisterClusterPreruns
}

// Fill this to register workspace cluster to a meta cluster
func (js *RegisterClusterStep) Run() error {
	commandToRun := fmt.Sprintf("gpctl")

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	panic("I am not implemented yet!")
}
