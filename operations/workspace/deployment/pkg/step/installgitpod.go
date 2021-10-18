// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"fmt"
	"os/exec"

	prerun "github.com/gitpod-io/gitpod/ws-deployment/pkg/check/prerun"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// InstallGitpodStep is the step which installs gitpod on a cluster
type InstallGitpodStep struct {
	ProjectContext *common.ProjectContext
	ClusterContext *common.ClusterContext
	Cluster        *common.WorkspaceCluster
	PreRuns        *prerun.InstallGitpodPreruns
}

// Fill this to install gitpod using helm
// We will not use argocd initially as it requires committing the override values file to the ops repo
// We assume our clusters to be immutable
func (gs *InstallGitpodStep) Run() error {
	// helm install gitpod gitpod -f values.production.yaml -f values.ws-cluster.yaml -f values.ws-cluster.us-west1.yaml -f values.versions.yaml -f values.production.ws.k3s01.yaml
	commandToRun := fmt.Sprintf("helm install")

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	panic("I am not implemented yet!")
}
