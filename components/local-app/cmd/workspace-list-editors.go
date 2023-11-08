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

		res := make([]tabularWorkspaceEditor, 0, len(editors.Msg.GetResult()))
		for _, editor := range editors.Msg.GetResult() {
			res = append(res, tabularWorkspaceEditor{
				ID:      editor.Id,
				Name:    editor.Title,
				Flavor:  editor.Label,
				Version: editor.Stable.Version,
			})
		}

		return WriteTabular(res, workspaceListEditorsOpts.Format, prettyprint.WriterFormatWide)
	},
}

type tabularWorkspaceEditor struct {
	ID      string `print:"id"`
	Name    string `print:"name"`
	Flavor  string `print:"flavor"`
	Version string `print:"version"`
}

var workspaceListEditorsOpts struct {
	Format formatOpts
}

var workspaceListEditorOpts workspaceListEditorsOptions

func init() {
	workspaceCmd.AddCommand(workspaceListEditors)

	workspaceListEditors.Flags().BoolVar(&workspaceListEditorOpts.Latest, "latest", false, "show latest versions instead of stable")
	addFormatFlags(workspaceListEditors, &workspaceListEditorsOpts.Format)
}
