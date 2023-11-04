// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var configGetContextsCmd = &cobra.Command{
	Use:   "get-contexts",
	Short: "Lists the available contexts",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		cfg := config.FromContext(cmd.Context())

		w := prettyprint.Writer{Out: cmd.OutOrStdout(), Field: configGetContextsOpts.Format.Field}
		return w.Write(tabularContexts{
			Active:   cfg.ActiveContext,
			Contexts: cfg.Contexts,
		})
	},
}

type tabularContexts struct {
	Active   string
	Contexts map[string]*config.ConnectionContext
}

// Header implements prettyprint.Tabular.
func (tabularContexts) Header() []string {
	return []string{"active", "name", "url", "organization"}
}

// Row implements prettyprint.Tabular.
func (tc tabularContexts) Row() []map[string]string {
	var res []map[string]string
	for name, gpctx := range tc.Contexts {
		res = append(res, map[string]string{
			"active":       prettyprint.FormatBool(tc.Active == name),
			"name":         name,
			"url":          gpctx.Host.String(),
			"organization": gpctx.OrganizationID,
		})
	}
	return res
}

var configGetContextsOpts struct {
	Format formatOpts
}

func init() {
	configCmd.AddCommand(configGetContextsCmd)
	addFormatFlags(configGetContextsCmd, &configGetContextsOpts.Format)
}
