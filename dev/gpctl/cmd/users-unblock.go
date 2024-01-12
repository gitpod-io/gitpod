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

// usersUnblockCmd represents the describe command
var usersUnblockCmd = &cobra.Command{
	Use:   "unblock <userID> ... <userID>",
	Short: "unblocks a user",
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
				IsBlocked: false,
			})
			if err != nil {
				log.WithError(err).Error("cannot unblock user")
			} else {
				log.WithField("uid", uid).Info("user unblocked")
			}
		}

	},
}

func init() {
	usersCmd.AddCommand(usersUnblockCmd)
}
