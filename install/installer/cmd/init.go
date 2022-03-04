// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Create a base config file",
	Long: `Create a base config file

This file contains all the credentials to install a Gitpod instance and
be saved to a repository.`,
	Example: `  # Save config to config.yaml.
  gitpod-installer init > config.yaml`,
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.NewDefaultConfig()
		if err != nil {
			panic(err)
		}
		fc, err := config.Marshal(config.CurrentVersion, cfg)
		if err != nil {
			panic(err)
		}

		fmt.Print(string(fc))
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
