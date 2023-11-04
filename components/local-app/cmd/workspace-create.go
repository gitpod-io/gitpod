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
	"github.com/spf13/cobra"
)

var workspaceClass string
var editor string

// workspaceCreateCmd creates a new workspace
var workspaceCreateCmd = &cobra.Command{
	Use:   "create <repo-url>",
	Short: "Creates a new workspace based on a given context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceErrors = true
		cmd.SilenceUsage = true

		passedArg := args[0]

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

		slog.Debug("Attempting to create workspace...", "org", orgId, "repo", passedArg)
		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: passedArg},
				OrganizationId: orgId,
				StartSpec: &v1.StartWorkspaceSpec{
					IdeSettings: &v1.IDESettings{
						DefaultIde:       editor,
						UseLatestVersion: false,
					},
					WorkspaceClass: workspaceClass,
				},
			},
		))
		if err != nil {
			return err
		}

		workspaceID := newWorkspace.Msg.WorkspaceId
		if len(workspaceID) == 0 {
			return fmt.Errorf("workspace was not created - please try creating the workspace again")
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

	Editor string
}

func init() {
	workspaceCmd.AddCommand(workspaceCreateCmd)
	addWorkspaceStartOptions(workspaceCreateCmd, &workspaceCreateOpts.StartOpts)

	workspaceCreateCmd.Flags().StringVar(&workspaceClass, "class", "", "the workspace class")
	workspaceCreateCmd.Flags().StringVar(&editor, "editor", "", "the editor to use")
}
