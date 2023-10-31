// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

// stopWorkspaceCommand stops to a given workspace
var getWorkspaceCommand = &cobra.Command{
	Use:   "get <workspace-id>",
	Short: "Retrieves metadata of a given workspace",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			workspaceID = common.SelectWorkspace(cmd.Context(), nil)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		slog.Debug("Attempting to retrieve workspace info...")
		ws, err := gitpod.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		wsInfo := ws.Msg.GetResult()
		repository := common.GetWorkspaceRepo(wsInfo)
		phase := common.HumanizeWorkspacePhase(wsInfo)

		createdAt := wsInfo.Status.Instance.CreatedAt
		createdTime := time.Unix(createdAt.Seconds, 0)

		data := &common.WorkspaceDisplayData{
			Id:         wsInfo.WorkspaceId,
			Url:        wsInfo.Status.Instance.Status.Url,
			Repository: repository,
			Branch:     common.GetWorkspaceBranch(wsInfo),
			Status:     phase,
			CreatedAt:  createdTime,
			// todo: LastActive, Created, WorkspaceClass (API implementation pending), RepoUrl (API implementation also pending)
		}

		outputInfo(data)

		return err
	},
}

func outputInfo(info *common.WorkspaceDisplayData) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetColWidth(50)
	table.SetBorder(false)
	table.SetColumnSeparator(":")
	table.Append([]string{"ID", info.Id})
	table.Append([]string{"URL", info.Url})
	// Class
	table.Append([]string{"Status", info.Status})
	// Repo URL
	table.Append([]string{"Repo", info.Repository})
	table.Append([]string{"Branch", info.Branch})
	table.Append([]string{"Created", info.CreatedAt.Format(time.RFC3339)})
	// Last Active (duration)
	table.Render()
}

func init() {
	wsCmd.AddCommand(getWorkspaceCommand)
}
