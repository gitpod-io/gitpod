// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/runner"
	"golang.org/x/xerrors"
)

const (
	// DefaultTFModuleGeneratorScriptPath is the path to script that must be invoked
	// from its parent dir in order to generate terraform modules
	DefaultTFModuleGeneratorScriptPath = "dev/build-ws-cluster/build-ws-cluster.sh"

	// DefaultGeneratedTFModulePathTemplate represents the path template where the default module
	// would be generated
	//
	// deploy/ws-clusters/{name}/terraform
	DefaultGeneratedTFModulePathTemplate = "deploy/ws-clusters/ws-%s/terraform"
)

func CreateCluster(context *common.ProjectContext, cluster *common.WorkspaceCluster) error {
	exists, err := doesClusterExist(context, cluster)
	// If we see an error finding out if cluster exists
	if err != nil {
		return xerrors.Errorf("issue finding out if cluster exists: %s", err)
	}
	// If the cluster already exists
	if exists {
		return xerrors.Errorf("cluster '%s' already exists", cluster.Name)
	}
	// If there is neither an error nor the cluster exist then continue
	err = generateTerraformModules(context, cluster)
	if err != nil {
		return err
	}
	err = applyTerraformModules(context, cluster)
	if err != nil {
		return err
	}
	return nil
}

func doesClusterExist(context *common.ProjectContext, cluster *common.WorkspaceCluster) (bool, error) {
	// container clusters describe gp-stag-ws-us11-us-weswt1 --project gitpod-staging --region us-west1
	out, err := exec.Command("gcloud", "container", "clusters", "describe", cluster.Name, "--project", context.Id, "--region", cluster.Region).CombinedOutput()
	if err == nil {
		return true, nil
	}
	outString := string(out)
	if strings.Contains(outString, "No cluster named") {
		return false, nil
	}
	log.Log.Errorf("cannot describe cluster: %s", outString)
	return false, err
}

func generateTerraformModules(context *common.ProjectContext, cluster *common.WorkspaceCluster) error {
	out, err := exec.Command(DefaultTFModuleGeneratorScriptPath, generateDefaultScriptArgs(context, cluster)...).CombinedOutput()
	log.Log.Errorf("error generating Terraform modules: %s", out)
	return err
}

func generateDefaultScriptArgs(context *common.ProjectContext, cluster *common.WorkspaceCluster) []string {
	// example `-b gitpod-staging-terraform -l europe-west1 -n us89 -t k3s -g gitpod-staging -w gitpod-staging -d gitpod-staging-com`
	return []string{"-b", context.Bucket, "-l", cluster.Region, "-n", cluster.Name, "-t", string(cluster.ClusterType), "-g", context.Id, "-w", context.Network, "-d", context.DNSZone}
}

func applyTerraformModules(context *common.ProjectContext, cluster *common.WorkspaceCluster) error {
	tfModulesDir := fmt.Sprintf(DefaultGeneratedTFModulePathTemplate, cluster.Name)
	commandToRun := fmt.Sprintf("cd %s && terraform init && terraform apply -auto-approve", tfModulesDir)
	err := runner.ShellRunWithDefaultConfig("/bin/sh", []string{"-c", commandToRun})
	return err
}
