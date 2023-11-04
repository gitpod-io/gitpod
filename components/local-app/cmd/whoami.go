// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Produces information about the current user",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		gpctx, err := config.FromContext(cmd.Context()).GetActiveContext()
		if err != nil {
			return err
		}

		client, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		user, err := client.User.GetAuthenticatedUser(cmd.Context(), &connect.Request[v1.GetAuthenticatedUserRequest]{})
		if err != nil {
			return err
		}
		org, err := client.Teams.GetTeam(cmd.Context(), &connect.Request[v1.GetTeamRequest]{Msg: &v1.GetTeamRequest{TeamId: gpctx.OrganizationID}})
		if err != nil {
			return err
		}

		w := prettyprint.Writer{Out: cmd.OutOrStdout(), Field: whoamiOpts.Format.Field, LongFormat: true}
		_ = w.Write(tabularWhoami{
			User: user.Msg.GetUser(),
			Org:  org.Msg.GetTeam(),
		})

		return nil
	},
}

type tabularWhoami struct {
	User *v1.User
	Org  *v1.Team
}

func (tabularWhoami) Header() []string {
	return []string{"user", "user id", "organization", "organization id"}
}

func (who tabularWhoami) Row() []map[string]string {
	return []map[string]string{
		{
			"user name":       who.User.Name,
			"user id":         who.User.Id,
			"organization":    who.Org.Name,
			"organization id": who.Org.Id,
		},
	}
}

var whoamiOpts struct {
	Format formatOpts
}

func init() {
	rootCmd.AddCommand(whoamiCmd)

	addFormatFlags(whoamiCmd, &whoamiOpts.Format)
}
