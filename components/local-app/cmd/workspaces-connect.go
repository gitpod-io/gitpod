// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/spf13/cobra"
)

var dryRun bool

// connectWorkspaceCommand connects to a given workspace
var connectWorkspaceCommand = &cobra.Command{
	Use:   "ssh <workspace-id>",
	Short: "Connects to a workspace via SSH",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			// Only select from workspaces that are currently running
			filter := func(ws *v1.Workspace) bool {
				return ws.GetStatus().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING
			}
			workspaceID = common.SelectWorkspace(cmd.Context(), filter)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		return common.SshConnectToWs(ctx, workspaceID, dryRun)
	},
}

func init() {
	wsCmd.AddCommand(connectWorkspaceCommand)
	connectWorkspaceCommand.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Dry run the command")
}
