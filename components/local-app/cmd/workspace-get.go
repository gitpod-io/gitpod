// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"log/slog"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/spf13/cobra"
)

var workspaceGetOpts struct {
	Format formatOpts
}

var workspaceGetCmd = &cobra.Command{
	Use:   "get <workspace-id>",
	Short: "Retrieves metadata of a given workspace",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		for _, workspaceID := range args {
			ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
			defer cancel()

			gitpod, err := getGitpodClient(ctx)
			if err != nil {
				return err
			}

			slog.Debug("Attempting to retrieve workspace info...")
			ws, err := gitpod.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
			if err != nil {
				return err
			}

			return workspaceGetOpts.Format.Writer(true).Write(tabularWorkspaces([]*v1.Workspace{ws.Msg.GetResult()}))
		}
		return nil
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceGetCmd)
	addFormatFlags(workspaceGetCmd, &workspaceGetOpts.Format)
}
