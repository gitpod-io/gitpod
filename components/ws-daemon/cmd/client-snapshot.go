// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/alecthomas/repr"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
)

// clientSnapshotCmd creates a workspace snapshot
var clientSnapshotCmd = &cobra.Command{
	Use:   "snapshot <id>",
	Short: "snapshots a workspace",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		req := api.TakeSnapshotRequest{Id: args[0]}

		conn, err := getGRPCConnection()
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		client := api.NewWorkspaceContentServiceClient(conn)
		ctx := context.Background()

		resp, err := client.TakeSnapshot(ctx, &req)
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		repr.Println(resp)
	},
}

func init() {
	clientCmd.AddCommand(clientSnapshotCmd)
}
