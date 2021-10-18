package step

import (
	"fmt"
	"os/exec"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// InstallJaegerStep is the step which installs jaeger on a cluster
type InstallJaegerStep struct {
	ProjectContext *common.ProjectContext
	ClusterContext *common.ClusterContext
	Cluster        *common.WorkspaceCluster
	PreRuns        *prerun.InstallJaegerPreruns
}

// Fill this to install jaeger using helm/other way
func (js *InstallJaegerStep) Run() error {
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
