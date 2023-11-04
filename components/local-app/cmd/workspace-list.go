// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/sagikazarmark/slog-shim"
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
		cmd.SilenceUsage = true

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

		return workspaceListOpts.Format.Writer(false).Write(tabularWorkspaces(workspaces.Msg.GetResult()))
	},
}

type tabularWorkspaces []*v1.Workspace

func (tabularWorkspaces) Header() []string {
	return []string{"id", "repository", "branch", "status"}
}

func (wss tabularWorkspaces) Row() []map[string]string {
	res := make([]map[string]string, 0, len(wss))
	for _, ws := range wss {
		if !helper.HasInstanceStatus(ws) {
			slog.Debug("workspace has no instance status - removing from output", "workspace", ws.WorkspaceId)
			continue
		}

		var repo string
		wsDetails := ws.Context.GetDetails()
		switch d := wsDetails.(type) {
		case *v1.WorkspaceContext_Git_:
			repo = fmt.Sprintf("%s/%s", d.Git.Repository.Owner, d.Git.Repository.Name)
		case *v1.WorkspaceContext_Prebuild_:
			repo = fmt.Sprintf("%s/%s", d.Prebuild.OriginalContext.Repository.Owner, d.Prebuild.OriginalContext.Repository.Name)
		}
		var branch string
		if ws.Status.Instance.Status.GitStatus != nil {
			branch = ws.Status.Instance.Status.GitStatus.Branch
			if branch == "" || branch == "(detached)" {
				branch = ""
			}
		}

		res = append(res, map[string]string{
			"id":         ws.WorkspaceId,
			"repository": repo,
			"branch":     branch,
			"status":     prettyprint.FormatWorkspacePhase(ws.Status.Instance.Status.Phase),
		})
	}
	return res
}

func init() {
	workspaceCmd.AddCommand(workspaceListCmd)
	addFormatFlags(workspaceListCmd, &workspaceListOpts.Format)
}
