// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/spf13/cobra"
)

// timeoutExtendCmd represents the timeoutExtendCmd command
var timeoutExtendCmd = &cobra.Command{
	Use:   "timeout-extend",
	Short: "Boost the timeout of this workspace",
	Args:  cobra.NoArgs,
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
		_, err = client.SetWorkspaceTimeout(ctx, wsInfo.WorkspaceId, *serverapi.WorkspaceTimeoutDuration180m)
		if err != nil {
			fail(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(timeoutExtendCmd)
}
