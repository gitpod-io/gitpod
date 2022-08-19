// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// configDetectCmd represents the validate command
var configDetectCmd = &cobra.Command{
	Use:   "detect",
	Short: "Performs detection tasks",
}

func init() {
	configCmd.AddCommand(configDetectCmd)
}
