// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log/slog"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

// workspaceCreateCmd creates a new workspace
var workspaceCreateCmd = &cobra.Command{
	Use:   "create <repo-url>",
	Short: "Creates a new workspace based on a given context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true
		repoURL := args[0]

		if workspaceCreateOpts.WorkspaceClass == "" {
			return prettyprint.AddResolution(fmt.Errorf("workspace class (--class) is required"),
				"list the available workspace classes using `{gitpod} workspace list-classes` and specify by passing the ID using `--class`",
			)
		}

		cfg := config.FromContext(cmd.Context())
		gpctx, err := cfg.GetActiveContext()
		if err != nil {
			return err
		}

		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		var (
			orgId = gpctx.OrganizationID
			ctx   = cmd.Context()
		)

		slog.Debug("Attempting to create workspace...", "org", orgId, "repo", repoURL)
		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: repoURL},
				OrganizationId: orgId,
				StartSpec: &v1.StartWorkspaceSpec{
					IdeSettings: &v1.IDESettings{
						DefaultIde:       workspaceCreateOpts.Editor,
						UseLatestVersion: false,
					},
					WorkspaceClass: workspaceCreateOpts.WorkspaceClass,
				},
			},
		))
		if err != nil {
			return err
		}

		workspaceID := newWorkspace.Msg.WorkspaceId
		if len(workspaceID) == 0 {
			return prettyprint.AddApology(prettyprint.AddResolution(fmt.Errorf("workspace was not created"),
				"try to create the workspace again",
			))
		}

		if workspaceCreateOpts.StartOpts.DontWait {
			// There is no more information to print other than the workspace ID. No need to faff with tabular pretty printing.
			fmt.Println(workspaceID)
			return nil
		}

		err = helper.ObserveWorkspaceUntilStarted(ctx, gitpod, workspaceID)
		if err != nil {
			return err
		}

		if workspaceCreateOpts.StartOpts.OpenSSH {
			return helper.SSHConnectToWorkspace(ctx, gitpod, workspaceID, false)
		}
		if workspaceCreateOpts.StartOpts.OpenEditor {
			return helper.OpenWorkspaceInPreferredEditor(ctx, gitpod, workspaceID)
		}

		return nil
	},
}

var workspaceCreateOpts struct {
	StartOpts workspaceStartOptions

	WorkspaceClass string
	Editor         string
}

func init() {
	workspaceCmd.AddCommand(workspaceCreateCmd)
	addWorkspaceStartOptions(workspaceCreateCmd, &workspaceCreateOpts.StartOpts)

	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.WorkspaceClass, "class", "", "the workspace class")
	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.Editor, "editor", "code", "the editor to use")
}
