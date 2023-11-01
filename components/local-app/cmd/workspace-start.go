// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/spf13/cobra"
)

var startDontWait = false
var startOpenSsh = false
var startOpenEditor = false

// startWorkspaceCommand starts to a given workspace
var startWorkspaceCommand = &cobra.Command{
	Use:   "start <workspace-id>",
	Short: "Start a given workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			filter := func(ws *v1.Workspace) bool {
				return ws.GetStatus().Instance.Status.Phase != v1.WorkspaceInstanceStatus_PHASE_RUNNING
			}
			workspaceID = common.SelectWorkspace(cmd.Context(), filter)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
		defer cancel()

		if startOpenSsh && startOpenEditor {
			return fmt.Errorf("Cannot open SSH and editor at the same time")
		}

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		fmt.Println("Attempting to start workspace...")
		wsInfo, err := gitpod.Workspaces.StartWorkspace(ctx, connect.NewRequest(&v1.StartWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		if wsInfo.Msg.GetResult().Status.Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING {
			fmt.Println("Workspace already running")
			return nil
		}

		if startDontWait {
			fmt.Println("Workspace initialization started")
			return nil
		}

		err = common.ObserveWsUntilStarted(ctx, workspaceID)
		if err != nil {
			return err
		}

		if startOpenSsh {
			return common.SshConnectToWs(ctx, workspaceID, false)
		}
		if startOpenEditor {
			return common.OpenWsInPreferredEditor(ctx, workspaceID)
		}

		return nil
	},
}

func init() {
	wsCmd.AddCommand(startWorkspaceCommand)
	startWorkspaceCommand.Flags().BoolVarP(&startDontWait, "dont-wait", "d", false, "do not wait for workspace to fully start, only initialize")
	startWorkspaceCommand.Flags().BoolVarP(&startOpenSsh, "ssh", "s", false, "open an SSH connection to workspace after starting")
	startWorkspaceCommand.Flags().BoolVarP(&startOpenEditor, "open", "e", false, "open the workspace in an editor after starting")
}
