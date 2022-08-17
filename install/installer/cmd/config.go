// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// configCmd represents the validate command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration commands",
}

func init() {
	rootCmd.AddCommand(configCmd)
}
