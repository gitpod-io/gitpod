// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/spf13/cobra"
	"time"
)

var uninstallConfig struct {
	timeout time.Duration
}

// uninstallCmd represents the uninstall command
var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall Gitpod from the cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		debug, err := cmd.Root().PersistentFlags().GetBool("debug")
		if err != nil {
			return err
		}

		dryRun, err := cmd.Root().PersistentFlags().GetBool("dry-run")
		if err != nil {
			return err
		}

		kubeconfig, err := cmd.Root().PersistentFlags().GetString("kubeconfig")
		if err != nil {
			return err
		}

		kubecontext, err := cmd.Root().PersistentFlags().GetString("kube-context")
		if err != nil {
			return err
		}

		name, err := cmd.Root().PersistentFlags().GetString("name")
		if err != nil {
			return err
		}

		namespace, err := cmd.Root().PersistentFlags().GetString("namespace")
		if err != nil {
			return err
		}

		if _, err = helm.Uninstall(&helm.Config{
			Debug:       debug,
			DryRun:      dryRun,
			KubeConfig:  kubeconfig,
			KubeContext: kubecontext,
			Name:        name,
			Namespace:   namespace,
			Timeout:     uninstallConfig.timeout,
		}); err != nil {
			return err
		}

		// Always print final line
		fmt.Println("Successfully uninstalled Gitpod from your cluster")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(uninstallCmd)

	uninstallCmd.Flags().DurationVar(&uninstallConfig.timeout, "timeout", time.Minute*5, "Time to wait for job to complete")
}
