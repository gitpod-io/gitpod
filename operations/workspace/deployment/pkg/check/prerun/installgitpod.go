package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// CreateClusterPreruns represents preruns before creating a cluster
type InstallGitpodPreruns struct {
	Cluster common.WorkspaceCluster
	PreRuns []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual creation
// of the cluster. It populates the calling object's `PreRuns` field
func (gp *InstallGitpodPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
