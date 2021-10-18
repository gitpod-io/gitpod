package step

import (
	"checks/prerun"
	v1 "config/v1"
)

type CreateClusterStep struct {
	Config  *v1.Config
	PreRuns *prerun.CreateClusterPreruns
}
