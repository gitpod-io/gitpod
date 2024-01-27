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

// extendTimeoutCmd extend timeout of current workspace
var extendTimeoutCmd = &cobra.Command{
	Use:   "extend",
	Short: "Extend timeout of current workspace",
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
		if _, err := client.SetWorkspaceTimeout(ctx, wsInfo.WorkspaceId, time.Minute*180); err != nil {
			if err, ok := err.(*jsonrpc2.Error); ok && err.Code == serverapi.PLAN_PROFESSIONAL_REQUIRED {
				return GpError{OutCome: utils.Outcome_UserErr, Message: "Cannot extend workspace timeout for current plan, please upgrade your plan", ErrorCode: utils.UserErrorCode_NeedUpgradePlan}
			}
			return err
		}
		fmt.Println("Workspace timeout has been extended to three hours.")
		return nil
	},
}

func init() {
	timeoutCmd.AddCommand(extendTimeoutCmd)
}
