package step

import (
	"fmt"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/infra"
	"golang.org/x/xerrors"
)

// CreateClusterStep is the step which creates a kubernetes cluster
type CreateClusterStep struct {
	ProjectContext *common.ProjectContext
	ClusterContext *common.ClusterContext
	Cluster        *common.WorkspaceCluster
	PreRuns        *prerun.CreateClusterPreruns
}

func (cs *CreateClusterStep) Run() error {
	tfModule := infra.TerraformModule{
		ClusterType:        cs.Cluster.ClusterType,
		ClusterPrefix:      cs.Cluster.Name, // the name of the cluster translates to cluster prefix
		ClusterEnvironment: cs.ProjectContext.Environment,
		Region:             cs.Cluster.Region,
		// The directory context must be changed before executing the below path
		// i.e. the current dir should be the ops repository home so that `deploy/xxx`
		// exists
		ScriptPath:     infra.DefaultTFModuleGeneratorScriptPath,
		ScriptPathArgs: generateDefaultScriptPathArgsString(cs),
	}

	err := tfModule.CreateTerraformModule()
	if err != nil {
		return xerrors.Errorf("Error creating terraform modules: %s", err)
	}

	err = tfModule.ApplyTerraformModule()
	if err != nil {
		return xerrors.Errorf("Error applying terraform modules: %s", err)
	}

	panic("I am not implemented yet!")
}

func generateDefaultScriptPathArgsString(cs *CreateClusterStep) string {
	// example `-e production -l europe-west1 -p us89 -t k3s`
	argsString := fmt.Sprintf("-e %s -l %s -p %s -t %s", cs.ProjectContext.Environment, cs.Cluster.Region, cs.Cluster.Name, cs.Cluster.ClusterType)
	return argsString
}
