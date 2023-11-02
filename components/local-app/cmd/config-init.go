// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var cfgInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize the configuration file of the CLI",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := config.CreateConfigFile()
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	cfgCmd.AddCommand(cfgInitCmd)
}
