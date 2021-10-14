// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesSubscribeCmd represents the describe command
var workspacesSubscribeCmd = &cobra.Command{
	Use:   "subscribe",
	Short: "subscribes to all workspace status updates",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		sub, err := client.Subscribe(ctx, &api.SubscribeRequest{})
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}
		defer sub.CloseSend()

		tpl := `{{ .Metadata.MetaId }}	{{ .Id }}	{{ .Phase -}}`
		for {
			resp, err := sub.Recv()
			if err != nil {
				log.WithError(err).Error()
				return
			}

			err = getOutputFormat(tpl, "{..id}").Print(resp.Status)
			if err != nil {
				log.WithError(err).Error()
				return
			}
			fmt.Println()
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesSubscribeCmd)
}
