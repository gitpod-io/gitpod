package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// RegisterClusterPreruns represents preruns before registering a cluster
type RegisterClusterPreruns struct {
	WorkspaceCluster *common.WorkspaceCluster
	MetaCluster      *common.MetaCluster
	ProjectContext   *common.ProjectContext
	PreRuns          []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before cluster
// registration. It populates the calling object's `PreRuns` field
func (gp *RegisterClusterPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
