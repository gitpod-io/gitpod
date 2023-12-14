// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

// organizationGetCmd gets a single organization
var organizationGetCmd = &cobra.Command{
	Use:   "get [organization-id]",
	Short: "Retrieves metadata about a given organization",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) < 1 {
			cfg := config.FromContext(cmd.Context())
			gpctx, err := cfg.GetActiveContext()
			if err != nil {
				return err
			}
			args = append(args, gpctx.OrganizationID)
		}

		var organizations []tabularTeam
		for _, orgId := range args {
			if len(orgId) == 0 {
				return cmd.Help()
			}

			ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
			defer cancel()

			gitpod, err := getGitpodClient(ctx)
			if err != nil {
				return err
			}

			orgs, err := gitpod.Teams.GetTeam(ctx, connect.NewRequest(&v1.GetTeamRequest{TeamId: orgId}))
			if err != nil {
				return err
			}

			organizations = append(organizations, tabularTeam{
				ID:   orgs.Msg.GetTeam().Id,
				Name: orgs.Msg.GetTeam().Name,
			})
		}
		return WriteTabular(organizations, organizationGetOpts.Format, prettyprint.WriterFormatNarrow)
	},
}

var organizationGetOpts struct {
	Format formatOpts
}

func init() {
	organizationCmd.AddCommand(organizationGetCmd)
	addFormatFlags(organizationGetCmd, &organizationGetOpts.Format)
}
