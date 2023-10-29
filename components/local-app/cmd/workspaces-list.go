// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"strings"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

func TranslatePhase(phase string) string {
	return strings.ToLower(phase[6:])
}

// listWorkspaceCommand lists all available workspaces
var listWorkspaceCommand = &cobra.Command{
	Use:   "list",
	Short: "Lists workspaces",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		workspaces, err := gitpod.Workspaces.ListWorkspaces(ctx, connect.NewRequest(&v1.ListWorkspacesRequest{}))
		if err != nil {
			return err
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Repo", "Branch", "Workspace ID", "Status"})
		table.SetBorder(false)
		table.SetColumnSeparator("")
		table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
		table.SetHeaderLine(false)

		for _, workspace := range workspaces.Msg.GetResult() {
			repository := "n/a"
			wsDetails := workspace.Context.GetDetails()
			switch d := wsDetails.(type) {
			case *v1.WorkspaceContext_Git_:
				repository = fmt.Sprintf("%s/%s", d.Git.Repository.Owner, d.Git.Repository.Name)
			case *v1.WorkspaceContext_Prebuild_:
				repository = fmt.Sprintf("%s/%s", d.Prebuild.OriginalContext.Repository.Owner, d.Prebuild.OriginalContext.Repository.Name)
			default:
				slog.Warn("event", "could not determine repository for workspace", workspace.WorkspaceId)
			}

			branch := workspace.GetStatus().Instance.Status.GitStatus.Branch

			table.Append([]string{repository, branch, workspace.WorkspaceId, TranslatePhase(workspace.GetStatus().Instance.Status.Phase.String())})
		}

		table.Render()

		return nil
	},
}

func init() {
	wsCmd.AddCommand(listWorkspaceCommand)
}
