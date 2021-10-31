// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package step

import (
	"strings"

	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/runner"
)

const (
	// DefaultGitpodInstallationScript is the path to script that must be invoked
	// from its parent dir to install gitpod
	DefaultGitpodInstallationScript = "dev/build-ws-cluster/install-gitpod.sh"
)

func InstallGitpod(context *common.ProjectContext, gitpodContext *common.GitpodContext, cluster *common.WorkspaceCluster) error {
	err := runner.ShellRunWithDefaultConfig(DefaultGitpodInstallationScript, []string{"-g", context.Id, "-l", cluster.Region, "-n", cluster.Name, "-a", getValuesFilesArgString(gitpodContext)})
	return err
}

func getValuesFilesArgString(gitpodContext *common.GitpodContext) string {
	// the first file name should also have -f before it so we add
	// it explicitly here
	//
	// so for something like:
	// [v1.yaml, v2.yaml. v3.yaml]
	// we get
	// -f v1.yaml -f v2.yaml -f v3.yaml
	return " -f " + strings.Join(gitpodContext.ValuesFiles, " -f ")
}
