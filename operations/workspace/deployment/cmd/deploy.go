/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"fmt"
	"math/rand"
	"os/exec"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/orchestrate"
	"github.com/spf13/cobra"
)

// deployCmd represents the deploy command
var deployCmd = &cobra.Command{
	Use:   "deploy",
	Short: "Creates a new workspace cluster and installs gitpod on it",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		verifyVersionsManifestFilePath(versionsManifestFile)

		rand.Seed(time.Now().UnixNano())
		randomId := fmt.Sprintf("%d", rand.Intn(200)+100)
		cfg.InitializeWorkspaceClusterNames(randomId) // TODO(prs):revisit and update this
		log.Log.Infof("%+v", cfg)
		// Activate google service account
		// mapping command: `gcloud auth activate-service-account --key-file ${GCLOUD_SERVICE_ACCOUNT_CRED_PATH}`
		out, err := exec.Command("gcloud", "auth", "activate-service-account", "--key-file", cfg.Project.GCPSACredFile).CombinedOutput()
		if err != nil {
			log.Log.Infof("error while trying to activate service account: %s. Assuming SA is already activated and configured %s", out)
		}
		orchestrate.Deploy(&cfg.Project, cfg.WorkspaceClusters)
	},
}

func init() {
	rootCmd.AddCommand(deployCmd)
}
