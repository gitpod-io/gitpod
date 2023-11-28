// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/runner"
	"github.com/spf13/cobra"
)

// workspaceRunnerCmd opens a given workspace in its pre-configured editor
var workspaceRunnerCmd = &cobra.Command{
	Use:   "runner",
	Short: "Starts a local workspace runner",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}
		whoami, err := gitpod.User.GetAuthenticatedUser(cmd.Context(), &connect.Request[v1.GetAuthenticatedUserRequest]{Msg: &v1.GetAuthenticatedUserRequest{}})
		if err != nil {
			return err
		}

		rnr := runner.NewLocalWorkspaceRunner(gitpod.Runner, whoami.Msg.User.Id)
		err = rnr.Run(cmd.Context())
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceRunnerCmd)
}
