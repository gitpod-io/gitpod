// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"
)

// usersBlockCmd represents the describe command
var usersVerifyCmd = &cobra.Command{
	Use:   "verify <userID> ... <userID>",
	Short: "verifies a user",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		verifyUser(ctx, args)
	},
}

func init() {
	usersCmd.AddCommand(usersVerifyCmd)
}
