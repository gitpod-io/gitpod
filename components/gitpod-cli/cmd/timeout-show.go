// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/spf13/cobra"
)

// showTimeoutCommand shows the workspace timeout
var showTimeoutCommand = &cobra.Command{
	Use:   "show",
	Short: "Show the current workspace timeout",
	Run: func(_ *cobra.Command, _ []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			fail(err.Error())
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:getWorkspaceTimeout",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			fail(err.Error())
		}

		res, err := client.GetWorkspaceTimeout(ctx, wsInfo.WorkspaceId)
		if err != nil {
			fail(err.Error())
		}

		// Try to use `DurationRaw` but fall back to `Duration` in case of
		// old server component versions that don't expose it.
		if res.DurationRaw != "" {
			fmt.Println(res.DurationRaw)
		} else {
			fmt.Println(res.Duration)
		}
	},
}

func init() {
	timeoutCmd.AddCommand(showTimeoutCommand)
}
