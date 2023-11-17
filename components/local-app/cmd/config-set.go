// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log/slog"
	"net/url"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var configSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Set an individual config value in the config file",
	Long: `Set an individual config value in the config file.

Example:
  # Disable telemetry
  gitpod config set --telemetry=false

  # Disable autoupdate
  gitpod config set --autoupdate=false

  # Enable telemetry and autoupdate
  gitpod config set --telemetry=true --autoupdate=true

  # Set your current context's organization
  gitpod config set --organization-id=your-org-id
`,
	Args: cobra.MaximumNArgs(1),
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

		gpctx, ok := cfg.Contexts[cfg.ActiveContext]
		if gpctx == nil {
			gpctx = &config.ConnectionContext{}
		}
		var ctxchanged bool
		if cmd.Flags().Changed("host") {
			host, err := url.Parse(configSetOpts.Host)
			if err != nil {
				return fmt.Errorf("invalid host: %w", err)
			}
			gpctx.Host = &config.YamlURL{URL: host}
			ctxchanged = true
		}
		if cmd.Flags().Changed("organization-id") {
			gpctx.OrganizationID = configSetOpts.OrganizationID
			ctxchanged = true
		}
		if cmd.Flags().Changed("token") {
			gpctx.Token = configSetOpts.Token
			ctxchanged = true
		}
		if ctxchanged && !ok {
			return fmt.Errorf("%w - some flags are tied to an active context: --organization-id, --host, --token", config.ErrNoContext)
		}
		if !update && !ctxchanged {
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

	Host           string
	OrganizationID string
	Token          string
}

func init() {
	configCmd.AddCommand(configSetCmd)
	configSetCmd.Flags().BoolVar(&configSetOpts.Autoupdate, "autoupdate", true, "enable/disable autoupdate")
	configSetCmd.Flags().BoolVar(&configSetOpts.Telemetry, "telemetry", true, "enable/disable telemetry")

	configSetCmd.Flags().StringVar(&configSetOpts.Host, "host", "", "the host to use for the context")
	configSetCmd.Flags().StringVar(&configSetOpts.OrganizationID, "organization-id", "", "the organization ID to use for the context")
	configSetCmd.Flags().StringVar(&configSetOpts.Token, "token", "", "the token to use for the context")
}
