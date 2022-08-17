// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/yq"
	"github.com/spf13/cobra"
)

func validateConfigFilePath(cmd *cobra.Command, args []string) error {
	if len(args) < 1 {
		return errors.New("config path required")
	}

	fileInfo, err := os.Stat(args[0])
	if err != nil && errors.Is(err, os.ErrNotExist) {
		return err
	}
	if fileInfo.IsDir() {
		return errors.New(fmt.Sprintf("%s must be a file - detected as directory", args[0]))
	}

	return nil
}

// configSetCmd represents the validate command
var configSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Configuration set command",
	Args: func(cmd *cobra.Command, args []string) error {
		// 0 - config path, 1 - yq expression
		err := cobra.MinimumNArgs(2)(cmd, args)
		if err != nil {
			return err
		}

		if err := validateConfigFilePath(cmd, args); err != nil {
			return err
		}

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		configPath := args[0]
		expression := args[1]

		config, err := os.ReadFile(configPath)
		if err != nil {
			return err
		}

		result, err := yq.Process(string(config), expression)
		if err != nil {
			return err
		}

		if err := os.WriteFile(configPath, []byte(*result), 0644); err != nil {
			return err
		}

		return nil
	},
}

func init() {
	configCmd.AddCommand(configSetCmd)
}
