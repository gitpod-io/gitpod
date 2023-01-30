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

// setTimeoutCmd sets the timeout of current workspace
var setTimeoutCmd = &cobra.Command{
	Use:   "set <duration>",
	Args:  cobra.ExactArgs(1),
	Short: "Set timeout of current workspace",
	Long: `Set timeout of current workspace.

Duration must be in the format of <n>m (minutes) or <n>h (hours).
For example, 30m, 1h`,
	Example: `gitpod timeout set 30m`,
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
		duration, err := time.ParseDuration(args[0])
		if err != nil {
			fail(err.Error())
		}
		if _, err := client.SetWorkspaceTimeout(ctx, wsInfo.WorkspaceId, duration); err != nil {
			if err, ok := err.(*jsonrpc2.Error); ok && err.Code == serverapi.PLAN_PROFESSIONAL_REQUIRED {
				fail("Cannot extend workspace timeout for current plan, please upgrade your plan")
			}
			fail(err.Error())
		}
		fmt.Printf("Workspace timeout has been set to %d minutes.\n", int(duration.Minutes()))
	},
}

func init() {
	timeoutCmd.AddCommand(setTimeoutCmd)
}
