// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var cfgGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration option",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) < 1 {
			return fmt.Errorf("not enough arguments")
		}

		key := args[0]

		value := config.Get(key)

		fmt.Println(value)

		return nil
	},
}

func init() {
	cfgCmd.AddCommand(cfgGetCmd)
}
