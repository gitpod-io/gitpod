// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var configContextUseCmd = &cobra.Command{
	Use:   "use <name>",
	Short: "Sets the active context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		targetContext := args[0]
		cfg := config.FromContext(cmd.Context())
		if _, ok := cfg.Contexts[targetContext]; !ok {
			return fmt.Errorf("unknown context: %s", targetContext)
		}
		cfg.ActiveContext = targetContext
		err := config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}
		return nil
	},
}

func init() {
	configContextCmd.AddCommand(configContextUseCmd)
}
