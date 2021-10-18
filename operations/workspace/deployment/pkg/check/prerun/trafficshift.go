package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// TrafficShiftPreruns represents preruns before shifting traffic
type TrafficShiftPreruns struct {
	Cluster        *common.WorkspaceCluster
	ProjectContext *common.ProjectContext
	PreRuns        []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual traffic
// shift. It populates the calling object's `PreRuns` field
func (gp *TrafficShiftPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
