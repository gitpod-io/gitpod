// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/spf13/cobra"
)

// extendTimeoutCmd extend timeout of current workspace
var extendTimeoutCmd = &cobra.Command{
	Use:   "extend",
	Short: "Extend timeout of current workspace",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			fail(err.Error())
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:setWorkspaceTimeout",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			fail(err.Error())
		}
		if _, err := client.SetWorkspaceTimeout(ctx, wsInfo.WorkspaceId, time.Minute*180); err != nil {
			if err, ok := err.(*jsonrpc2.Error); ok && err.Code == serverapi.PLAN_PROFESSIONAL_REQUIRED {
				fail("Cannot extend workspace timeout for current plan, please upgrade your plan")
			}
			fail(err.Error())
		}
		fmt.Println("Workspace timeout extended to 180 minutes.")
	},
}

func init() {
	timeoutCmd.AddCommand(extendTimeoutCmd)
}
