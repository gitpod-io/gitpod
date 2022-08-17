// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

// configNewCmd represents the validate command
var configNewCmd = &cobra.Command{
	Use:   "new",
	Short: "Create a base config file",
	Long: `Create a base config file

This file contains all the credentials to install a Gitpod instance and
be saved to a repository.`,
	Example: `  # Save config to config.yaml.
  gitpod-installer config new config.yaml`,
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		configPath := args[0]

		cfg, err := config.NewDefaultConfig()
		if err != nil {
			return err
		}
		fc, err := config.Marshal(config.CurrentVersion, cfg)
		if err != nil {
			return err
		}

		return os.WriteFile(configPath, fc, 0644)
	},
}

func init() {
	configCmd.AddCommand(configNewCmd)
}
