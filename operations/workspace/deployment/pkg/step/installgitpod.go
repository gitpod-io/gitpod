package step

import (
	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	v1 "github.com/gitpod-io/gitpod/ws-deployment/pkg/config/v1"
)

// InstallGitpodStep is the step which installs gitpod on a cluster
type InstallGitpodStep struct {
	Config  *v1.Config
	PreRuns *prerun.CreateClusterPreruns
}

func (gs *InstallGitpodStep) Run() error {
	panic("I am not implemented yet!")
}
