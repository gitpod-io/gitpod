// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
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

		res := make([]tabularWorkspaceClass, 0, len(classes.Msg.GetResult()))
		for _, class := range classes.Msg.GetResult() {
			res = append(res, tabularWorkspaceClass{
				ID:          class.Id,
				Name:        class.DisplayName,
				Description: class.Description,
			})
		}

		return WriteTabular(res, workspaceListClassesOpts.Format, prettyprint.WriterFormatNarrow)
	},
}

type tabularWorkspaceClass struct {
	ID          string `print:"id"`
	Name        string `print:"name"`
	Description string `print:"description"`
}

var workspaceListClassesOpts struct {
	Format formatOpts
}

func init() {
	workspaceCmd.AddCommand(workspaceListClassesCmd)
	addFormatFlags(workspaceListClassesCmd, &workspaceListClassesOpts.Format)
}
