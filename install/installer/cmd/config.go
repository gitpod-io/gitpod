// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// configCmd represents the validate command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Perform configuration tasks",
}

func init() {
	rootCmd.AddCommand(configCmd)
}
