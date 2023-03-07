// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
)

// usersBlockCmd represents the describe command
var usersBlockCmd = &cobra.Command{
	Use:   "block <userID> ... <userID>",
	Short: "blocks a user",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		client, err := newLegacyAPIConn()
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer client.Close()

		for _, uid := range args {
			err = client.AdminBlockUser(ctx, &protocol.AdminBlockUserRequest{
				UserID:    uid,
				IsBlocked: true,
			})
			if err != nil {
				log.WithError(err).Error("cannot block user")
			} else {
				log.WithField("uid", uid).Info("user blocked")
			}
		}

	},
}

func init() {
	usersCmd.AddCommand(usersBlockCmd)
}
