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
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var workspaceClass string
var editor string

// createWorkspaceCommand creates a new workspace
var createWorkspaceCommand = &cobra.Command{
	Use:   "create <repo-url>",
	Short: "Creates a new workspace based on a given context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		passedArg := args[0]

		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		orgId := config.GetOrganizationId()
		if len(orgId) == 0 {
			return fmt.Errorf("No org specified. Specify an organization ID using the GITPOD_ORG_ID environment variable")
		}

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		slog.Debug("Attempting to create workspace...")
		slog.Debug(orgId)
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
				}}))

		if err != nil {
			return err
		}

		if len(newWorkspace.Msg.WorkspaceId) == 0 {
			return fmt.Errorf("Exception: API did not return a workspace ID back. Please try creating the workspace again")
		}

		fmt.Println(newWorkspace.Msg.WorkspaceId)
		return nil
	},
}

func init() {
	wsCmd.AddCommand(createWorkspaceCommand)
	createWorkspaceCommand.Flags().StringVarP(&workspaceClass, "class", "c", "", "the workspace class")
	createWorkspaceCommand.Flags().StringVarP(&editor, "editor", "e", "", "the editor to use")
}
