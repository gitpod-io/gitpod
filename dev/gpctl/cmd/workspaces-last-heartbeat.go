// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesLastHeartbeatCmd get workspace last heartbeat time
var workspacesLastHeartbeatCmd = &cobra.Command{
	Use:   "last-heartbeat <instanceID>",
	Short: "get workspace last heartbeat time",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		instanceID := args[0]

		resp, err := client.DescribeWorkspace(ctx, &api.DescribeWorkspaceRequest{
			Id: instanceID,
		})
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		fmt.Println(resp.LastActivity)
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesLastHeartbeatCmd)
}
