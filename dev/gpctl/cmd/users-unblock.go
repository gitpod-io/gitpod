// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"
)

// usersUnblockCmd represents the describe command
var usersUnblockCmd = &cobra.Command{
	Use:   "unblock <userID> ... <userID>",
	Short: "unblocks a user",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		blockUser(ctx, args, false)
	},
}

func init() {
	usersCmd.AddCommand(usersUnblockCmd)
}
