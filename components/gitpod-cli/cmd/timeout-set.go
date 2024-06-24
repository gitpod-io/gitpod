// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
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

Duration must be in the format of <n>m (minutes), <n>h (hours) and cannot be longer than 24 hours.
For example: 30m or 1h`,
	Example: fmt.Sprintf("%s %s set 1h", rootCmd.Use, timeoutCmd.Use),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:setWorkspaceTimeout",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			return err
		}
		defer client.Close()
		duration, err := time.ParseDuration(args[0])
		if err != nil {
			return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		res, err := client.SetWorkspaceTimeout(ctx, wsInfo.WorkspaceId, duration)
		if err != nil {
			if err, ok := err.(*jsonrpc2.Error); ok && err.Code == serverapi.PLAN_PROFESSIONAL_REQUIRED {
				return GpError{OutCome: utils.Outcome_UserErr, Message: "Cannot extend workspace timeout for current plan, please upgrade your plan", ErrorCode: utils.UserErrorCode_NeedUpgradePlan}
			}
			return err
		}
		fmt.Printf("Workspace timeout has been set to %s.\n", getHumanReadableDuration(res.HumanReadableDuration, duration))
		return nil
	},
}

func getHumanReadableDuration(humanReadableDuration string, inputDuration time.Duration) string {
	readable := humanReadableDuration
	if humanReadableDuration == "" {
		readable = fmt.Sprintf("%d minutes", int(inputDuration.Minutes()))
	}
	return readable
}

func init() {
	timeoutCmd.AddCommand(setTimeoutCmd)
}
