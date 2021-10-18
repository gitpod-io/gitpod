package prerun

import "common/cluster"

type InstallGitpodPreruns struct {
	Cluster cluster.WorkspaceCluster
	PreRuns []*IPreRun
}

// gkeClusterWithNameExists
// CreatePreRuns creates a set of pre runs to be executed before actual creation
// of the cluster. It populates the calling object's `PreRuns` field
func (gp *InstallGitpodPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
