// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log/slog"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var configSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Set an individual config value in the config file",
	Long: `Set an individual config value in the config file.

Example:
  # Disable telemetry
  local-app config set --telemetry=false

  # Disable autoupdate
  local-app config set --autoupdate=false

  # Enable telemetry and autoupdate
  local-app config set --telemetry=true --autoupdate=true
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		var update bool
		cfg := config.FromContext(cmd.Context())
		if cmd.Flags().Changed("autoupdate") {
			cfg.Autoupdate = configSetOpts.Autoupdate
			update = true
		}
		if cmd.Flags().Changed("telemetry") {
			cfg.Telemetry.Enabled = configSetOpts.Telemetry
			update = true
		}
		if !update {
			return cmd.Help()
		}

		slog.Debug("updating config")
		err := config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}
		return nil
	},
}

var configSetOpts struct {
	Autoupdate bool
	Telemetry  bool
}

func init() {
	configCmd.AddCommand(configSetCmd)
	configSetCmd.Flags().BoolVar(&configSetOpts.Autoupdate, "autoupdate", true, "enable/disable autoupdate")
	configSetCmd.Flags().BoolVar(&configSetOpts.Telemetry, "telemetry", true, "enable/disable telemetry")
}
