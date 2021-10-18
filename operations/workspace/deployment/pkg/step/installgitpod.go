package step

import (
	"checks/prerun"
	v1 "config/v1"
)

type InstallGitpodStep struct {
	Config  *v1.Config
	PreRuns *prerun.CreateClusterPreruns
}

func (gs *InstallGitpodStep) Run() error {
	panic("I am not implemented yet!")
}
