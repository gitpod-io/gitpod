// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var cfgCmd = &cobra.Command{
	Use:   "config",
	Short: "Change the configuration of the CLI",
}

func init() {
	rootCmd.AddCommand(cfgCmd)
}
