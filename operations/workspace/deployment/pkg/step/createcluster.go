package step

import (
	v1 "github.com/gitpod-io/gitpod/ws-deployment/pkg/config/v1"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
)

// CreateClusterStep is the step which creates a kubernetes cluster
type CreateClusterStep struct {
	Config  *v1.Config
	PreRuns *prerun.CreateClusterPreruns
}
