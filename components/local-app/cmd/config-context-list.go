// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var configContextsListCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the available contexts",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		cfg := config.FromContext(cmd.Context())

		res := make([]tabularContext, 0, len(cfg.Contexts))
		for name, ctx := range cfg.Contexts {
			res = append(res, tabularContext{
				Active:       name == cfg.ActiveContext,
				Name:         name,
				Host:         ctx.Host.String(),
				Organization: ctx.OrganizationID,
			})
		}

		return WriteTabular(res, configContextsListpts.Format, prettyprint.WriterFormatWide)
	},
}

type tabularContext struct {
	Active       bool
	Name         string
	Host         string
	Organization string
}

var configContextsListpts struct {
	Format formatOpts
}

func init() {
	configContextCmd.AddCommand(configContextsListCmd)
	addFormatFlags(configContextsListCmd, &configContextsListpts.Format)
}
