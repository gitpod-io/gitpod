package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// InstallJaegerPreruns represents preruns before installing
type InstallJaegerPreruns struct {
	Cluster        *common.WorkspaceCluster
	ProjectContext *common.ProjectContext
	PreRuns        []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual installation of
// jaeger. It populates the calling object's `PreRuns` field
func (gp *InstallJaegerPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
