package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// CreateClusterPreruns represents preruns before creating a cluster
type CreateClusterPreruns struct {
	Cluster common.WorkspaceCluster
	Context common.ProjectContext
	PreRuns []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual creation
// of the cluster. It populates the calling object's `PreRuns` field
func (cp *CreateClusterPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}

// Fill this so that we check if the cluster with given name
func (cp *CreateClusterPreruns) addClusterDoesNotExistPrerun() {
	panic("I am not implemented yet")
}
