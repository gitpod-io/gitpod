// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/spf13/cobra"
)

// dockerRegistryCmd represents the dockerRegistry command
var dockerRegistryCmd = &cobra.Command{
	Use:   "docker-registry",
	Short: "Install a Docker registry to your Gitpod cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		debug, err := cmd.Root().PersistentFlags().GetBool("debug")
		if err != nil {
			return err
		}

		return helm.Wrapper(helm.DockerRegistry(), debug)
	},
}

func init() {
	rootCmd.AddCommand(dockerRegistryCmd)
}
