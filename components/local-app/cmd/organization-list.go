// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

// organizationListCmd lists all available organizations
var organizationListCmd = &cobra.Command{
	Use:     "list",
	Short:   "Lists organizations",
	Aliases: []string{"ls"},
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		orgs, err := gitpod.Teams.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))
		if err != nil {
			return err
		}

		res := make([]tabularTeam, 0, len(orgs.Msg.GetTeams()))
		for _, org := range orgs.Msg.GetTeams() {
			res = append(res, tabularTeam{
				ID:   org.Id,
				Name: org.Name,
			})
		}
		return WriteTabular(res, organizationListOpts.Format, prettyprint.WriterFormatWide)
	},
}

type tabularTeam struct {
	ID   string `print:"id"`
	Name string `print:"name"`
}

var organizationListOpts struct {
	Format formatOpts
}

func init() {
	organizationCmd.AddCommand(organizationListCmd)
	addFormatFlags(organizationListCmd, &organizationListOpts.Format)
}
