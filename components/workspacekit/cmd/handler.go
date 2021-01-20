// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// handlerCmd represents the base command for all syscall handler
var handlerCmd = &cobra.Command{
	Use:   "handler",
	Short: "In-namespace calls for syscall handling",
}

func init() {
	rootCmd.AddCommand(handlerCmd)
}
