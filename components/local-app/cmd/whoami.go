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

		return WriteTabular([]whoamiResult{
			{
				Name:  user.Msg.GetUser().Name,
				ID:    user.Msg.GetUser().Id,
				Org:   org.Msg.GetTeam().Name,
				OrgID: org.Msg.GetTeam().Id,
				Host:  gpctx.Host.String(),
			},
		}, whoamiOpts.Format, prettyprint.WriterFormatNarrow)
	},
}

type whoamiResult struct {
	Name  string `print:"user name"`
	ID    string `print:"user id"`
	Org   string `print:"organization"`
	OrgID string `print:"organization id"`
	Host  string `print:"host"`
}

var whoamiOpts struct {
	Format formatOpts
}

func init() {
	rootCmd.AddCommand(whoamiCmd)

	addFormatFlags(whoamiCmd, &whoamiOpts.Format)
}
