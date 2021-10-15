// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// validateCmd represents the validate command
var validateCmd = &cobra.Command{
	Use:     "validate",
	Short:   "Performs validation tasks",
	Aliases: []string{"verify"},
}

func init() {
	rootCmd.AddCommand(validateCmd)
}
