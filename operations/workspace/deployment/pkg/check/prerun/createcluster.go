package prerun

import (
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// CreateClusterPreruns represents preruns before creating a cluster
type CreateClusterPreruns struct {
	Cluster        *common.WorkspaceCluster
	ProjectContext *common.ProjectContext
	PreRuns        []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual creation
// of the cluster. It populates the calling object's `PreRuns` field
func (cp *CreateClusterPreruns) CreatePreRuns() error {
	cp.addClusterDoesNotExistPrerun()
	panic("I am not implemented yet!")
}

func (cp *CreateClusterPreruns) addClusterDoesNotExistPrerun() {
	cp.addGKEClusterDoesNotExistPrerun()
	cp.addK3sClusterDoesNotExistPrerun()
	panic("I am not implemented yet")
}

// Fill this to add a check for gke cluster does not exist
func (cp *CreateClusterPreruns) addGKEClusterDoesNotExistPrerun() {
	if cp.Cluster.ClusterType != common.ClusterTypeGKE {
		return
	}
	panic("I am not implemented yet")
}

// Fill this to add a check for k3s cluster does not exist
func (cp *CreateClusterPreruns) addK3sClusterDoesNotExistPrerun() {
	if cp.Cluster.ClusterType != common.ClusterTypeK3s {
		return
	}
	panic("I am not implemented yet")
}
