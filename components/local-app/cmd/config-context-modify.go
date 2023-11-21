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

var configContextModifyCmd = &cobra.Command{
	Use:     "modify <name | --current>",
	Short:   "Modifies a context entry in the gitpod CLI config",
	Aliases: []string{"add-context"},
	Args:    cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		cfg := config.FromContext(cmd.Context())
		var targetContext string
		if configContextModifyOpts.Current {
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
			host, err := url.Parse(configContextModifyOpts.Host)
			if err != nil {
				return fmt.Errorf("invalid host: %w", err)
			}
			gpctx.Host = &config.YamlURL{URL: host}
		}
		if cmd.Flags().Changed("organization-id") {
			gpctx.OrganizationID = configContextModifyOpts.OrganizationID
		}
		if cmd.Flags().Changed("token") {
			gpctx.Token = configContextModifyOpts.Token
		}

		err := config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}
		return nil
	},
}

var configContextModifyOpts struct {
	Current        bool
	Host           string
	OrganizationID string
	Token          string
}

func init() {
	configContextCmd.AddCommand(configContextModifyCmd)

	configContextModifyCmd.Flags().BoolVar(&configContextModifyOpts.Current, "current", false, "modify the current context")
	configContextModifyCmd.Flags().StringVar(&configContextModifyOpts.Host, "host", "", "the host to use for the context")
	configContextModifyCmd.Flags().StringVar(&configContextModifyOpts.OrganizationID, "organization-id", "", "the organization ID to use for the context")
	configContextModifyCmd.Flags().StringVar(&configContextModifyOpts.Token, "token", "", "the token to use for the context")
}
