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

type workspaceListEditorsOptions struct {
	Latest bool
}

// workspaceListEditors lists available editor options
var workspaceListEditors = &cobra.Command{
	Use:   "list-editors",
	Short: "Lists workspace editor options",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		editors, err := gitpod.Editors.ListEditorOptions(ctx, connect.NewRequest(&v1.ListEditorOptionsRequest{}))
		if err != nil {
			return err
		}

		return workspaceListEditorsOpts.Format.Writer(false).Write(tabularWorkspaceEditors(editors.Msg.GetResult()))
	},
}

type tabularWorkspaceEditors []*v1.EditorOption

func (t tabularWorkspaceEditors) Header() []string {
	return []string{"id", "name", "flavor", "version"}
}

func (t tabularWorkspaceEditors) Row() []map[string]string {
	res := make([]map[string]string, 0, len(t))
	for _, editor := range t {
		version := editor.Stable.Version
		if workspaceListEditorOpts.Latest {
			version = editor.Latest.Version
		}
		res = append(res, map[string]string{
			"name":    editor.Title,
			"flavor":  editor.Label,
			"id":      editor.Id,
			"version": version,
		})
	}
	return res
}

var workspaceListEditorsOpts struct {
	Format formatOpts
}

var workspaceListEditorOpts workspaceListEditorsOptions

func init() {
	workspaceCmd.AddCommand(workspaceListEditors)

	workspaceListEditors.Flags().BoolVar(&workspaceListEditorOpts.Latest, "latest", false, "try to show latest versions instead of stable")

	addFormatFlags(workspaceListEditors, &workspaceListEditorsOpts.Format)
}
