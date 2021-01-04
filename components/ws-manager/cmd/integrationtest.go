// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// integrationTestCmd represents the integrationTest command
var integrationTestCmd = &cobra.Command{
	Use:   "integration-test",
	Short: "Helps with ws-manager's integration tests",
	Args:  cobra.ExactArgs(1),
}

func init() {
	rootCmd.AddCommand(integrationTestCmd)
	integrationTestCmd.PersistentFlags().String("kubeconfig", "local", "path to a kubeconfig file or local to use $HOME/.kube/config")
}
