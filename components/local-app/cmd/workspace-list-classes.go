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

var classesListOutputField string

// Accepts an array of workspace classes and outputs them in a table
func outputClasses(classes []*v1.WorkspaceClass) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Name", "Description", "Id"})
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetBorder(false)
	table.SetColumnSeparator("")
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetHeaderLine(false)

	for _, class := range classes {
		table.Append([]string{class.DisplayName, class.Description, class.Id})
	}

	table.Render()
}

// listWorkspaceClassesCommand lists all available organizations
var listWorkspaceClassesCommand = &cobra.Command{
	Use:   "list-classes",
	Short: "Lists workspace classes",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		classes, err := gitpod.Workspaces.ListWorkspaceClasses(ctx, connect.NewRequest(&v1.ListWorkspaceClassesRequest{}))
		if err != nil {
			return err
		}

		classData := classes.Msg.GetResult()

		if classesListOutputField != "" {
			classesListOutputField = common.CapitalizeFirst(classesListOutputField)
			for _, class := range classData {
				val := reflect.ValueOf(class).Elem()
				if fieldVal := val.FieldByName(classesListOutputField); fieldVal.IsValid() {
					fmt.Printf("%v\n", fieldVal.Interface())
				} else {
					return fmt.Errorf("Field '%s' is an invalid field for workspace classes", classesListOutputField)
				}
			}
			return nil
		}

		outputClasses(classData)

		return nil
	},
}

func init() {
	wsCmd.AddCommand(listWorkspaceClassesCommand)
	listWorkspaceClassesCommand.Flags().StringVarP(&classesListOutputField, "field", "f", "", "output a specific field of the classes")
}
