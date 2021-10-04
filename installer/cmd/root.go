// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "gitpod-installer",
	Short: "Installs Gitpod",
}

func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}

func init() {
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Enable verbose output")
	rootCmd.PersistentFlags().BoolP("dry-run", "", false, "Simulate an install")
	rootCmd.PersistentFlags().StringP("kube-context", "", "", "Name of the kubeconfig context to use")
	rootCmd.PersistentFlags().StringP("kubeconfig", "", "", "Path to the kubeconfig file")
	rootCmd.PersistentFlags().StringP("name", "n", "gitpod", "Installation name")
	rootCmd.PersistentFlags().StringP("namespace", "", "default", "namespace to deploy to")
}
