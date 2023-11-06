// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net/url"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var configSetContext = &cobra.Command{
	Use:     "set-context <name | --current>",
	Short:   "Set a context entry in the gitpod CLI config",
	Aliases: []string{"add-context"},
	Args:    cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		cfg := config.FromContext(cmd.Context())
		var targetContext string
		if configSetContextOpts.Current {
			if len(args) > 0 {
				return prettyprint.AddResolution(fmt.Errorf("cannot use --current and specify a context name"),
					"modify current context with `{gitpod} config set-context --current`",
					"modify/create a different context with `{gitpod} config set-context <name>`",
				)
			}
			targetContext = cfg.ActiveContext
		} else {
			if len(args) == 0 {
				return prettyprint.AddResolution(fmt.Errorf("must specify a context name or use --current"),
					"modify current context with `{gitpod} config set-context --current`",
					"modify/create a different context with `{gitpod} config set-context <name>`",
				)
			}
			targetContext = args[0]
		}

		gpctx := cfg.Contexts[targetContext]
		if gpctx == nil {
			gpctx = &config.ConnectionContext{}
			cfg.Contexts[targetContext] = gpctx
		}
		if cmd.Flags().Changed("host") {
			host, err := url.Parse(configSetContextOpts.Host)
			if err != nil {
				return fmt.Errorf("invalid host: %w", err)
			}
			gpctx.Host = &config.YamlURL{URL: host}
		}
		if cmd.Flags().Changed("organization-id") {
			gpctx.OrganizationID = configSetContextOpts.OrganizationID
		}
		if cmd.Flags().Changed("token") {
			gpctx.Token = configSetContextOpts.Token
		}

		err := config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}
		return nil
	},
}

var configSetContextOpts struct {
	Current        bool
	Host           string
	OrganizationID string
	Token          string
}

func init() {
	configCmd.AddCommand(configSetContext)

	configSetContext.Flags().BoolVar(&configSetContextOpts.Current, "current", false, "modify the current context")
	configSetContext.Flags().StringVar(&configSetContextOpts.Host, "host", "", "the host to use for the context")
	configSetContext.Flags().StringVar(&configSetContextOpts.OrganizationID, "organization-id", "", "the organization ID to use for the context")
	configSetContext.Flags().StringVar(&configSetContextOpts.Token, "token", "", "the token to use for the context")
}
