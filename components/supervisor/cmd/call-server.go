// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/gitpod"
	"github.com/spf13/cobra"
)

var callServerCmd = &cobra.Command{
	Use:    "call-server <host> <token>",
	Hidden: true,
	Args:   cobra.MinimumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		var (
			ctx   = context.Background()
			host  = args[0]
			token = args[1]
		)

		api, err := gitpod.ConnectToServer(fmt.Sprintf("ws://%s/api/v1", host), gitpod.ConnectToServerOpts{
			Token: token,
		})
		if err != nil {
			log.Fatal("ConnectToServer", err)
		}
		defer api.Close()

		usr, err := api.GetLoggedInUser(ctx)
		if err != nil {
			log.Fatal("GetLoggedInUser", err)
		}
		json.NewEncoder(os.Stdout).Encode(usr)
	},
}

func init() {
	rootCmd.AddCommand(callServerCmd)
}
