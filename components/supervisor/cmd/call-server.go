// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

var callServerCmd = &cobra.Command{
	Use:    "call-server <host> <token>",
	Hidden: true,
	Args:   cobra.MinimumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		var (
			ctx, cancel = context.WithCancel(context.Background())
			host        = args[0]
			token       = args[1]
		)
		defer cancel()

		api, err := gitpod.ConnectToServer(fmt.Sprintf("ws://%s/api/v1", host), gitpod.ConnectToServerOpts{
			Token: token,
			Log:   log.Log,
		})
		if err != nil {
			log.WithError(err).Fatal("ConnectToServer")
		}
		defer api.Close()

		usr, err := api.GetLoggedInUser(ctx)
		if err != nil {
			log.WithError(err).Fatal("GetLoggedInUser")
		}

		err = json.NewEncoder(os.Stdout).Encode(usr)
		if err != nil {
			log.WithError(err).Error("encoding user")
		}

		enc := json.NewEncoder(os.Stdout)
		enc.SetEscapeHTML(false)
		enc.SetIndent("", "  ")

		instanceID, _ := cmd.Flags().GetString("instance-id")
		updates, err := api.InstanceUpdates(ctx, instanceID)
		if err != nil {
			log.WithError(err).Fatal("InstanceUpdates")
		}
		for u := range updates {
			err := enc.Encode(u)
			if err != nil {
				log.WithError(err).Error("encoding update")
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(callServerCmd)

	callServerCmd.Flags().String("instance-id", os.Getenv("GITPOD_INSTANCE_ID"), "instance ID to listen for")
}
