// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"k8s.io/client-go/kubernetes"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/registry-credential/pkg/ecr"
)

var rootCmd = &cobra.Command{
	Use:   "ecr-update",
	Short: "Update ECR Secret with a new ecr login.",
	Long:  `Update ECR Secret with a new ecr login`,
	Run: func(cmd *cobra.Command, args []string) {
		kubeConfig, err := ctrl.GetConfig()
		if err != nil {
			log.WithError(err).Fatal("unable to getting Kubernetes client config")
		}

		client, err := kubernetes.NewForConfig(kubeConfig)
		if err != nil {
			log.WithError(err).Fatal("constructing Kubernetes client")
		}
		namespace, _ := os.LookupEnv("NAMESPACE")

		ecr.UpdateCredential(client, namespace)
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

func init() {
	rootCmd.AddCommand(rootCmd)
}
