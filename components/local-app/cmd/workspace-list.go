// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var workspaceListOpts struct {
	Format formatOpts
}

// workspaceListCmd lists all available workspaces
var workspaceListCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists workspaces",
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		cfg := config.FromContext(ctx)
		gpctx, err := cfg.GetActiveContext()
		if err != nil {
			return err
		}
		orgId := gpctx.OrganizationID

		workspaces, err := gitpod.Workspaces.ListWorkspaces(ctx, connect.NewRequest(&v1.ListWorkspacesRequest{
			OrganizationId: orgId,
		}))
		if err != nil {
			return err
		}

		w := prettyprint.Writer{Out: os.Stdout, Field: workspaceListOpts.Format.Field}
		_ = w.Write(tabularWorkspaces(workspaces.Msg.GetResult()))

		return nil
	},
}

type tabularWorkspaces []*v1.Workspace

func (tabularWorkspaces) Header() []string {
	return []string{"repository", "branch", "workspace", "status"}
}

func (wss tabularWorkspaces) Row() []map[string]string {
	res := make([]map[string]string, 0, len(wss))
	for _, ws := range wss {
		res = append(res, map[string]string{
			"repository": common.GetWorkspaceRepo(ws),
			"branch":     common.GetWorkspaceBranch(ws),
			"workspace":  ws.WorkspaceId,
			"status":     common.HumanizeWorkspacePhase(ws),
		})
	}
	return res
}

func init() {
	workspaceCmd.AddCommand(workspaceListCmd)
	addFormatFlags(workspaceListCmd, &workspaceListOpts.Format)
}
