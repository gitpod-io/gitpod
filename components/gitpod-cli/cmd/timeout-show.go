// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/spf13/cobra"
)

// showTimeoutCommand shows the workspace timeout
var showTimeoutCommand = &cobra.Command{
	Use:   "show",
	Short: "Show the current workspace timeout",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:getWorkspaceTimeout",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			return err
		}
		defer client.Close()

		res, err := client.GetWorkspaceTimeout(ctx, wsInfo.WorkspaceId)
		if err != nil {
			return err
		}
		duration, err := time.ParseDuration(res.Duration)
		if err != nil {
			return err
		}

		fmt.Printf("Workspace timeout is set to %s.\n", getHumanReadableDuration(res.HumanReadableDuration, duration))
		return nil
	},
}

func init() {
	timeoutCmd.AddCommand(showTimeoutCommand)
}
