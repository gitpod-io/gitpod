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

// workspacesStopCmd represents the describe command
var workspacesStopCmd = &cobra.Command{
	Use:   "stop <workspaceID>",
	Short: "stops a workspace",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		policy := api.StopWorkspacePolicy_NORMALLY
		stopImmediately, _ := cmd.Flags().GetBool("immediately")
		if stopImmediately {
			policy = api.StopWorkspacePolicy_IMMEDIATELY
		}

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

		resp, err := client.StopWorkspace(ctx, &api.StopWorkspaceRequest{
			Id:     instanceID,
			Policy: policy,
		})
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		err = getOutputFormat("stopping\n", "").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesStopCmd)
	workspacesStopCmd.Flags().Bool("immediately", false, "stops a workspace immediately we no regard for backups or clean shutdown")
}
