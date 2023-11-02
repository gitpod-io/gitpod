// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/spf13/cobra"
)

// workspaceCreateCommand creates a new workspace
var workspaceCreateCommand = &cobra.Command{
	Use:   "create <repo-url>",
	Short: "Creates a new workspace based on a given context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		passedArg := args[0]

		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		orgId := getOrganizationID()
		if len(orgId) == 0 {
			return fmt.Errorf("no organisation specified. Specify an organization ID using the GITPOD_ORG_ID environment variable")
		}

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		slog.Debug("Attempting to create workspace...", "org", orgId, "repo", passedArg)
		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: passedArg},
				OrganizationId: orgId,
				StartSpec: &v1.StartWorkspaceSpec{
					IdeSettings: &v1.IDESettings{
						DefaultIde:       workspaceCreateOpts.Editor,
						UseLatestVersion: false,
					},
					WorkspaceClass: workspaceCreateOpts.WorkspaceClass,
				}}))

		if err != nil {
			return err
		}

		workspaceID := newWorkspace.Msg.WorkspaceId

		if len(workspaceID) == 0 {
			return fmt.Errorf("did not receive a workspace ID from the API; please try creating the workspace again")
		}

		if workspaceCreateOpts.DontWait {
			fmt.Println(workspaceID)
			return nil
		}

		_, err = common.ObserveWorkspaceUntilStarted(ctx, workspaceID)
		if err != nil {
			return err
		}

		if workspaceCreateOpts.OpenSsh {
			return common.SSHConnectToWorkspace(ctx, workspaceID, false)
		}
		if workspaceCreateOpts.OpenEditor {
			return common.OpenWsInPreferredEditor(ctx, workspaceID)
		}

		return nil
	},
}

var workspaceCreateOpts struct {
	WorkspaceClass string
	Editor         string
	DontWait       bool
	OpenSsh        bool
	OpenEditor     bool
}

func init() {
	workspaceCmd.AddCommand(workspaceCreateCommand)
	workspaceCreateCommand.Flags().BoolVarP(&workspaceCreateOpts.DontWait, "dont-wait", "d", false, "don't wait for the workspace to start and just print out the newly created workspace's ID")
	workspaceCreateCommand.Flags().StringVarP(&workspaceCreateOpts.WorkspaceClass, "class", "c", "", "the workspace class")
	workspaceCreateCommand.Flags().StringVarP(&workspaceCreateOpts.Editor, "editor", "e", "", "the editor to use")
	workspaceCreateCommand.Flags().BoolVar(&workspaceCreateOpts.OpenSsh, "ssh", false, "open an SSH connection to workspace after starting")
	workspaceCreateCommand.Flags().BoolVarP(&workspaceCreateOpts.OpenEditor, "open", "o", false, "open the workspace in an editor after starting")
}
