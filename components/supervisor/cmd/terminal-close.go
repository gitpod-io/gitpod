// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

var terminalCloseCmd = &cobra.Command{
	Use:   "close <alias>",
	Short: "closes a terminal",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewTerminalServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		_, err := client.Shutdown(ctx, &api.ShutdownTerminalRequest{
			Alias: args[0],
		})
		if err != nil {
			log.WithError(err).Fatal("cannot close terminals")
		}
	},
}

func init() {
	terminalCmd.AddCommand(terminalCloseCmd)
}
