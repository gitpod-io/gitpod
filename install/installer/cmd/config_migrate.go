// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"
)

// configMigrateCmd represents the config migration command
var configMigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Migrate the configuration YAML to the currently supported version",
	Args: func(cmd *cobra.Command, args []string) error {
		// receive the target config version to migrate to
		if len(args) != 1 {
			return errors.New("new configuration version is required")
		}

		// @todo(sje): validate that the version is acceptable

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return fmt.Errorf("this command is a placeholder for when a new version is introduced")
	},
}

func init() {
	configCmd.AddCommand(configMigrateCmd)
}
