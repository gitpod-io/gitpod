// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var cfgSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Update a configuration option",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key, value := args[0], args[1]
		err := config.Set(key, value)

		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	cfgCmd.AddCommand(cfgSetCmd)
}
