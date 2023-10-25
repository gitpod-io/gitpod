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
	"github.com/gitpod-io/local-app/common"
	"github.com/spf13/cobra"
)

var nonBlocking = false

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

		if nonBlocking {
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

// stopWorkspaceCommand stops to a given workspace
var stopWorkspaceCommand = &cobra.Command{
	Use:   "stop <workspace-id>",
	Short: "Stop a given workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			filter := func(ws *v1.Workspace) bool {
				return ws.GetStatus().Instance.Status.Phase != v1.WorkspaceInstanceStatus_PHASE_STOPPED
			}
			workspaceID = common.SelectWorkspace(cmd.Context(), filter)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		fmt.Println("Attempting to stop workspace...")
		wsInfo, err := gitpod.Workspaces.StopWorkspace(ctx, connect.NewRequest(&v1.StopWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		currentPhase := wsInfo.Msg.GetResult().Status.Instance.Status.Phase

		if currentPhase == v1.WorkspaceInstanceStatus_PHASE_STOPPED {
			fmt.Println("Workspace is already stopped")
			return nil
		}

		if currentPhase == v1.WorkspaceInstanceStatus_PHASE_STOPPING {
			fmt.Println("Workspace is already stopping")
			return nil
		}

		if nonBlocking {
			fmt.Println("Workspace stopping")
			return nil
		}

		stream, err := gitpod.Workspaces.StreamWorkspaceStatus(ctx, connect.NewRequest(&v1.StreamWorkspaceStatusRequest{WorkspaceId: workspaceID}))

		if err != nil {
			return err
		}

		fmt.Println("Waiting for workspace to stop...")

		fmt.Println("Workspace " + TranslatePhase(currentPhase.String()))

		previousStatus := ""

		for stream.Receive() {
			msg := stream.Msg()
			if msg == nil {
				fmt.Println("No message received")
				continue
			}

			if msg.GetResult().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_STOPPED {
				fmt.Println("Workspace stopped")
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

// workspaceStatusCommand prints the status of a given workspace
var workspaceStatusCommand = &cobra.Command{
	Use:   "status <workspace-id>",
	Short: "Print the status of a given workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			workspaceID = common.SelectWorkspace(cmd.Context(), nil)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		wsInfo, err := gitpod.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		currentPhase := wsInfo.Msg.GetResult().Status.Instance.Status.Phase

		fmt.Println(TranslatePhase(currentPhase.String()))
		return nil
	},
}

func init() {
	wsCmd.AddCommand(startWorkspaceCommand)
	startWorkspaceCommand.Flags().BoolVarP(&nonBlocking, "non-blocking", "n", false, "do not wait for workspace to fully start, only initialize")

	wsCmd.AddCommand(stopWorkspaceCommand)
	stopWorkspaceCommand.Flags().BoolVarP(&nonBlocking, "non-blocking", "n", false, "do not wait for workspace to fully stop, only initialize")

	wsCmd.AddCommand(workspaceStatusCommand)
}
