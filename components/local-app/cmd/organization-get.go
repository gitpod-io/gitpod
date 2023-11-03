// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

// Accepts an array of orgs and outputs them in a table
func outputOrgs(orgs []*v1.Team) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Name", "Id"})
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetBorder(false)
	table.SetColumnSeparator("")
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetHeaderLine(false)

	for _, org := range orgs {
		table.Append([]string{org.Name, org.Id})
	}

	table.Render()
}

// organizationGetCmd gets all available organizations
var organizationGetCmd = &cobra.Command{
	Use:   "get [organization-id]",
	Short: "gets an organization's details",
	RunE: func(cmd *cobra.Command, args []string) error {
		var orgId string
		if len(args) < 1 {
			cfg := config.FromContext(cmd.Context())
			gpctx, err := cfg.GetActiveContext()
			if err != nil {
				return err
			}
			orgId = gpctx.OrganizationID
		} else {
			orgId = args[0]
		}

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

		outputOrgs([]*v1.Team{orgs.Msg.GetTeam()})

		return nil
	},
}

func init() {
	organizationCmd.AddCommand(organizationGetCmd)
}
