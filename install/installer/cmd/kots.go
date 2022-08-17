// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// kotsCmd represents the validate command
var kotsCmd = &cobra.Command{
	Use:   "kots",
	Short: "Performs KOTS tasks",
}

func init() {
	rootCmd.AddCommand(kotsCmd)
}
