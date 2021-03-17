// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesSnapshotCmd listens for workspace updates
var workspacesSnapshotCmd = &cobra.Command{
	Use:   "snapshot <instanceID>",
	Short: "takes a snapshot of a workspace and uploads it to the remote storage",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		instanceID := args[0]
		if strings.ContainsAny(instanceID, ".") || strings.HasPrefix(instanceID, "http://") || strings.HasPrefix(instanceID, "https://") {
			s, err := getStatusByURL(ctx, client, instanceID)
			if err != nil {
				log.Fatal(err)
			}
			instanceID = s.Id
		}

		resp, err := client.TakeSnapshot(context.Background(), &api.TakeSnapshotRequest{
			Id: instanceID,
		})

		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		err = getOutputFormat("{{ .Url }}\n", "{.url}").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesSnapshotCmd)
}
