// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// debugCmd represents the debugCmd command
var debugCmd = &cobra.Command{
	Use:   "debug",
	Short: "Helps with debugging a component",
	Args:  cobra.ExactArgs(1),
}

func init() {
	rootCmd.AddCommand(debugCmd)
}
