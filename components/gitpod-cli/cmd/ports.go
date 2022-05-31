// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/gitpod-cli/cmd/ports"
	"github.com/spf13/cobra"
)

var portsCmd = &cobra.Command{
	Use:   "ports",
	Short: "Interact with workspace ports.",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			_ = cmd.Help()
		}
	},
}

var listPortsCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace ports and their states.",
	Run:   ports.ListPortsCmd,
}

func init() {
	rootCmd.AddCommand(portsCmd)
	portsCmd.AddCommand(listPortsCmd)
}
