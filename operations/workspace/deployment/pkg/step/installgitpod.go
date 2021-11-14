// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

const (
	// DefaultGitpodInstallationScript is the path to script that must be invoked
	// from its parent dir to install gitpod
	DefaultGitpodInstallationScript = "dev/build-ws-cluster/install-gitpod.sh"
)

func InstallGitpod(context *common.Context, cluster *common.WorkspaceCluster) error {
	if context.Overrides.DryRun {
		log.Log.Infof("dry run not supported for gitpod installation. skipping...")
		return nil
	}
	if cluster.ClusterType == common.ClusterTypeGKE {
		return installGitpodOnGKECluster(context, cluster)
	} else {
		return installGitpodOnK3sCluster(context, cluster)
	}
}

func installGitpodOnK3sCluster(context *common.Context, cluster *common.WorkspaceCluster) error {
	log.Infof("gitpod installation on k3s not supported yet")
	return nil
}

func installGitpodOnGKECluster(context *common.Context, cluster *common.WorkspaceCluster) error {
	credFileEnvVar := fmt.Sprintf("GOOGLE_APPLICATION_CREDENTIALS=%s", context.Project.GCPSACredFile)
	if _, err := os.Stat(context.Project.GCPSACredFile); errors.Is(err, os.ErrNotExist) {
		// reset this to empty string so that we can fallback to default
		// gcloud context. This is useful in local development and execution
		// scenarios
		credFileEnvVar = ""
	}

	var err error
	// Script execution is prone to failure and recover on retry
	// So only retry part of the code
	for attempt := 0; attempt <= context.Overrides.RetryAttempt; attempt++ {
		cmd := exec.Command(DefaultGitpodInstallationScript, "-g", context.Project.Id, "-l", cluster.Region, "-n", cluster.Name, "-v", context.Gitpod.VersionsManifestFilePath, "-a", getValuesFilesArgString(cluster.ValuesFiles))
		// Set the env variable
		cmd.Env = append(os.Environ(), credFileEnvVar)
		// we will route the output to standard devices
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err = cmd.Run()
		if err == nil {
			break
		}
	}
	return err

}

func getValuesFilesArgString(valuesFiles []string) string {
	// the first file name should also have -f before it so we add
	// it explicitly here
	//
	// so for something like:
	// [v1.yaml, v2.yaml. v3.yaml]
	// we get
	// -f v1.yaml -f v2.yaml -f v3.yaml
	return " -f " + strings.Join(valuesFiles, " -f ")
}
