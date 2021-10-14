// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// dependencyCmd represents the dependency command
var dependencyCmd = &cobra.Command{
	Use:     "dependency",
	Short:   "Manage Gitpod dependencies",
	Aliases: []string{"dependencies", "deps", "dep"},
}

func init() {
	rootCmd.AddCommand(dependencyCmd)
}
