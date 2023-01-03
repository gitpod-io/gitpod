// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"k8s.io/client-go/kubernetes"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/refresh-credential/pkg/config"
	"github.com/gitpod-io/gitpod/refresh-credential/pkg/ecr"
)

var rootCmd = &cobra.Command{
	Use:   "ecr <config.json>",
	Short: "Refresh the AWS ECR credential",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		cfgFile := args[1]
		cfg := config.Get(cfgFile)
		log.WithField("config", cfg).Info("Starting refresh-credential")

		kubeConfig, err := ctrl.GetConfig()
		if err != nil {
			log.WithError(err).Fatal("unable to getting Kubernetes client config")
		}

		client, err := kubernetes.NewForConfig(kubeConfig)
		if err != nil {
			log.WithError(err).Fatal("constructing Kubernetes client")
		}

		ecr.RefreshCredential(client, cfg)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
