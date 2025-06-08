// Copyright (c) Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var dotfilesCmd = &cobra.Command{
	Use:   "dotfiles",
	Short: "Manage your dotfiles repository.",
	Long:  `Manage your dotfiles repository.`,
}

func init() {
	rootCmd.AddCommand(dotfilesCmd)
}
