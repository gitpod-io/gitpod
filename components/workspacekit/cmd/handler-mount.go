// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// handlerCmd represents the base command for all syscall handler
var handlerMountCmd = &cobra.Command{
	Use:   "mount",
	Short: "In-namespace mount handler",
	Args:  cobra.ExactArgs(4),
	Run: func(cmd *cobra.Command, args []string) {

	},
}

func init() {
	handlerCmd.AddCommand(handlerMountCmd)
}
