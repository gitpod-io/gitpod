package step

import (
	"fmt"
	"os/exec"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// InstallMonitoring is the step which installs monitoring satellite on a cluster
type InstallMonitoringStep struct {
	ProjectContext *common.ProjectContext
	ClusterContext *common.ClusterContext
	Cluster        *common.WorkspaceCluster
	PreRuns        *prerun.InstallMonitoringPreruns
}

// Fill this to install monitoring
func (js *InstallMonitoringStep) Run() error {
	// helm install jaeger
	commandToRun := fmt.Sprintf("helm install")

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	panic("I am not implemented yet!")
}
