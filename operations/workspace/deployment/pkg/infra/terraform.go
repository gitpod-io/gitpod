// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package infra

import (
	"fmt"
	"os/exec"
	"path/filepath"

	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

const (
	// DefaultTFModuleGeneratorScriptPath is the path to script that must be invoked
	// from its parent dir in order to generate terraform modules
	DefaultTFModuleGeneratorScriptPath = "dev/build-ws-cluster/build-ws-cluster.sh"

	// DefaultGeneratedTFModulePathTemplate represents the path template where the default module
	// would be generated
	//
	// deploy/{environment}/ws-{prefix}/terraform
	DefaultGeneratedTFModulePathTemplate = "deploy/%s/ws-%s/terraform"

	// DefaultGeneratedArgoCDPathTemplate represents the path template where the default module
	// would be generated
	//
	// deploy/{environment}/ws-{prefix}/terraform
	DefaultGeneratedArgoCDPathTemplate = "deploy/%s/ws-%s/argocd"
)

// TerraformModule defines a set of variables to describe generation of the module and
// input values
//
// ./build-ws-cluster.sh -e production -l europe-west1 -p us89 -t k3s
type TerraformModule struct {
	ClusterType        common.ClusterType
	ClusterPrefix      string
	ClusterEnvironment common.Environment

	Region         string
	ScriptPath     string
	ScriptPathArgs string
	ModulePath     string
}

// CreateTerraformModule creates a terraform module for kubernetes cluster creation and other resources
// required to install gitpod
func (tm *TerraformModule) CreateTerraformModule() error {
	scriptPathDir := filepath.Dir(tm.ScriptPath)
	scriptPathDirName := filepath.Base(scriptPathDir)

	// cd {scriptPathDirName} && ./{ScriptPath} {ScriptPathArgs}
	//
	// e.g.
	// cd dev/build-ws-cluster && ./build-ws-cluster.sh -e production -l europe-west1 -p us89 -t k3s
	//
	// here `-e production -l europe-west1 -p us89 -t k3s` is the args
	commandToRun := fmt.Sprintf(`cd %s && ./%s %s`, scriptPathDirName, tm.ScriptPath, tm.ScriptPathArgs)

	// commandToRun := fmt.Sprintf(`export KUBECONFIG=%s && gcloud container clusters get-credentials %s --project %s --zone %s`, kubeconfigPath, clusterName, projectId, region)
	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	return nil
}

// ApplyTerraformModule does an equivalent of `terraform apply -auto-approve`
func (tm *TerraformModule) ApplyTerraformModule() error {
	modulePathDir := filepath.Dir(tm.ModulePath)
	modulePathDirName := filepath.Base(modulePathDir)

	// TODO(prs): Replace this with stable terraform-exec when it is released
	// cd {modulePathDirName} && terraform init && terraform apply -auto-approve
	//
	// e.g.
	// cd deploy/production/ws-us89/terraform && terraform init && terraform apply -auto-approve
	commandToRun := fmt.Sprintf(`cd %s && terraform init && terraform apply -auto-approve`, modulePathDirName)

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	return nil
}

// DestroyTerraformModule does an equivalent of `terraform destroy -auto-approve`
func (tm *TerraformModule) DestroyTerraformModule() error {
	modulePathDir := filepath.Dir(tm.ModulePath)
	modulePathDirName := filepath.Base(modulePathDir)

	// TODO(prs): Replace this with stable terraform-exec when it is released
	// cd {modulePathDirName} && terraform destroy -auto-approve
	//
	// e.g.
	// cd deploy/production/ws-us89/terraform && terraform destroy -auto-approve
	commandToRun := fmt.Sprintf(`cd %s && terraform destroy -auto-approve`, modulePathDirName)

	cmd := exec.Command("/bin/sh", "-c", commandToRun)
	err := cmd.Run()
	stdout, _ := cmd.Output()
	fmt.Print(string(stdout))
	if err != nil {
		return err
	}
	return nil
}
