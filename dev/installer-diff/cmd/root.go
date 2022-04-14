// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "installer-diff",
	Short: "",
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
	// hd, err := os.UserHomeDir()
	// if err != nil {
	// 	log.WithError(err).Warn("cannot determine user home dir")
	// }
	// rootCmd.PersistentFlags().String("kubeconfig", filepath.Join(hd, ".kube", "config"), "path to the kubeconfig file (defaults to $HOME/.kube/config)")

	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
