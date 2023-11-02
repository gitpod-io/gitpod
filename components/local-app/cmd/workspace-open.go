// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"log/slog"
	"time"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/spf13/cobra"
)

// openWorkspaceCommand opens a given workspace in its pre-configured editor
var openWorkspaceCommand = &cobra.Command{
	Use:   "open <workspace-id>",
	Short: "Opens a given workspace in its pre-configured editor",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			filter := func(ws *v1.Workspace) bool {
				return ws.GetStatus().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING
			}
			workspaceID = common.SelectWorkspace(cmd.Context(), filter)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		slog.Debug("Attempting to open workspace...")
		return common.OpenWsInPreferredEditor(ctx, workspaceID)
	},
}

func init() {
	workspaceCmd.AddCommand(openWorkspaceCommand)
}
