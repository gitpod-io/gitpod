// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
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

		stream, err := gitpod.Workspaces.StreamWorkspaceStatus(ctx, connect.NewRequest(&v1.StreamWorkspaceStatusRequest{WorkspaceId: workspaceID}))

		if err != nil {
			return err
		}

		fmt.Println("Waiting for workspace to start...")

		fmt.Println("Workspace " + TranslatePhase(wsInfo.Msg.GetResult().Status.Instance.Status.Phase.String()))

		previousStatus := ""

		for stream.Receive() {
			msg := stream.Msg()
			if msg == nil {
				fmt.Println("No message received")
				continue
			}

			if msg.GetResult().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING {
				fmt.Println("Workspace started")
				if startOpenSsh {
					err = common.SshConnectToWs(ctx, workspaceID, false)
					return err
				}
				break
			}

			currentStatus := TranslatePhase(msg.GetResult().Instance.Status.Phase.String())

			if currentStatus != previousStatus {
				fmt.Println("Workspace " + currentStatus)
				previousStatus = currentStatus
			}
		}

		if err := stream.Err(); err != nil {
			log.Fatalf("Failed to receive: %v", err)
			return err
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
