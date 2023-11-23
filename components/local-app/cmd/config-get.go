// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var configGetCmd = &cobra.Command{
	Use:   "get",
	Short: "Get an individual config value in the config file",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		cfg := config.FromContext(cmd.Context())

		host := "not set"
		organizationID := "not set"

		gpctx, ok := cfg.Contexts[cfg.ActiveContext]
		if !ok {
			gpctx = &config.ConnectionContext{}
		} else {
			host = gpctx.Host.Host
			organizationID = gpctx.OrganizationID
		}

		return WriteTabular([]struct {
			Telemetry      bool   `header:"Telemetry"`
			Autoupdate     bool   `header:"Autoupdate"`
			Host           string `header:"Host"`
			OrganizationID string `header:"OrganizationID" print:"organization id"`
		}{
			{Telemetry: cfg.Telemetry.Enabled, Autoupdate: cfg.Autoupdate, Host: host, OrganizationID: organizationID},
		}, configGetOpts.Format, prettyprint.WriterFormatNarrow)
	},
}

var configGetOpts struct {
	Format formatOpts
}

func init() {
	configCmd.AddCommand(configGetCmd)
	addFormatFlags(configGetCmd, &configGetOpts.Format)
}
