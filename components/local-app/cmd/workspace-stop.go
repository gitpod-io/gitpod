// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"log/slog"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var stopDontWait = false

// workspaceStopCommand stops to a given workspace
var workspaceStopCommand = &cobra.Command{
	Use:   "stop <workspace-id>",
	Short: "Stop a given workspace",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := args[0]

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		slog.Info("stopping workspace...")
		wsInfo, err := gitpod.Workspaces.StopWorkspace(ctx, connect.NewRequest(&v1.StopWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		currentPhase := wsInfo.Msg.GetResult().Status.Instance.Status.Phase

		if currentPhase == v1.WorkspaceInstanceStatus_PHASE_STOPPED {
			slog.Info("workspace is already stopped")
			return nil
		}
		if currentPhase == v1.WorkspaceInstanceStatus_PHASE_STOPPING {
			slog.Info("workspace is already stopping")
			return nil
		}
		if stopDontWait {
			slog.Info("workspace stopping")
			return nil
		}

		stream, err := gitpod.Workspaces.StreamWorkspaceStatus(ctx, connect.NewRequest(&v1.StreamWorkspaceStatusRequest{WorkspaceId: workspaceID}))

		if err != nil {
			return err
		}

		slog.Info("waiting for workspace to stop...")
		slog.Info("Workspace " + prettyprint.FormatWorkspacePhase(currentPhase))

		previousStatus := ""

		for stream.Receive() {
			msg := stream.Msg()
			if msg == nil {
				slog.Debug("no message received")
				continue
			}

			if msg.GetResult().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_STOPPED {
				slog.Info("workspace stopped")
				break
			}

			currentStatus := prettyprint.FormatWorkspacePhase(msg.GetResult().Instance.Status.Phase)
			if currentStatus != previousStatus {
				slog.Info("workspace " + currentStatus)
				previousStatus = currentStatus
			}
		}

		if err := stream.Err(); err != nil {
			return err
		}

		return nil
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceStopCommand)
	workspaceStopCommand.Flags().BoolVarP(&stopDontWait, "dont-wait", "d", false, "do not wait for workspace to fully stop, only initialize")
}
