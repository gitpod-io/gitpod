package step

import (
	"checks/prerun"
	v1 "config/v1"
)

// CreateClusterStep is the step which creates a kubernetes cluster
type CreateClusterStep struct {
	Config  *v1.Config
	PreRuns *prerun.CreateClusterPreruns
}
