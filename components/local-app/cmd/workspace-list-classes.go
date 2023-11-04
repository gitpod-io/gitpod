// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/spf13/cobra"
)

// workspaceListClassesCmd lists available workspace classes
var workspaceListClassesCmd = &cobra.Command{
	Use:   "list-classes",
	Short: "Lists workspace classes",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		classes, err := gitpod.Workspaces.ListWorkspaceClasses(ctx, connect.NewRequest(&v1.ListWorkspaceClassesRequest{}))
		if err != nil {
			return err
		}

		return workspaceListClassesOpts.Format.Writer(false).Write(tabularWorkspaceClasses(classes.Msg.GetResult()))
	},
}

type tabularWorkspaceClasses []*v1.WorkspaceClass

func (t tabularWorkspaceClasses) Header() []string {
	return []string{"id", "name", "description"}
}

func (t tabularWorkspaceClasses) Row() []map[string]string {
	res := make([]map[string]string, 0, len(t))
	for _, class := range t {
		res = append(res, map[string]string{
			"name":        class.DisplayName,
			"description": class.Description,
			"id":          class.Id,
		})
	}
	return res
}

var workspaceListClassesOpts struct {
	Format formatOpts
}

func init() {
	workspaceCmd.AddCommand(workspaceListClassesCmd)
	addFormatFlags(workspaceListClassesCmd, &workspaceListClassesOpts.Format)
}
