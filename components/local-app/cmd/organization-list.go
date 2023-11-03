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
	Use:   "list",
	Short: "Lists organizations",
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

		w := prettyprint.Writer{Out: cmd.OutOrStdout(), Field: listOrganizationOpts.Format.Field}
		return w.Write(tabularTeam(orgs.Msg.GetTeams()))
	},
}

type tabularTeam []*v1.Team

// Header implements prettyprint.Tabular.
func (tabularTeam) Header() []string {
	return []string{"id", "name"}
}

// Row implements prettyprint.Tabular.
func (orgs tabularTeam) Row() []map[string]string {
	res := make([]map[string]string, 0, len(orgs))
	for _, org := range orgs {
		res = append(res, map[string]string{
			"id":   org.Id,
			"name": org.Name,
		})
	}
	return res
}

var _ prettyprint.Tabular = &tabularTeam{}

var listOrganizationOpts struct {
	Format formatOpts
}

func init() {
	organizationCmd.AddCommand(organizationListCmd)
	addFormatFlags(organizationListCmd, &listOrganizationOpts.Format)
}
