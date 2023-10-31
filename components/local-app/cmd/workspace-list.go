// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

var wsListOutputField string

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
			repository := common.GetWorkspaceRepo(workspace)
			branch := common.GetWorkspaceBranch(workspace)

			wsData := common.WorkspaceDisplayData{
				Repository: repository,
				Branch:     branch,
				Id:         workspace.WorkspaceId,
				Status:     common.HumanizeWorkspacePhase(workspace),
			}

			if wsListOutputField != "" {
				wsListOutputField = common.CapitalizeFirst(wsListOutputField)
				val := reflect.ValueOf(wsData)
				if fieldVal := val.FieldByName(wsListOutputField); fieldVal.IsValid() {
					fmt.Printf("%v\n", fieldVal.Interface())
				} else {
					return fmt.Errorf("Field '%s' is an invalid field for workspaces", wsListOutputField)
				}
			} else {
				table.Append([]string{wsData.Repository, wsData.Branch, wsData.Id, wsData.Status})
			}
		}

		if wsListOutputField == "" {
			table.Render()
		}

		return nil
	},
}

func init() {
	wsCmd.AddCommand(listWorkspaceCommand)
	listWorkspaceCommand.Flags().StringVarP(&wsListOutputField, "field", "f", "", "output a specific field of the workspaces")
}
