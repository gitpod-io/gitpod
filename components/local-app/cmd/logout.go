// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/config"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/spf13/cobra"
)

// loginCmd represents the login command
var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logs the user out from the stored Gitpod account",
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		return auth.DeleteToken(config.GetString("host"))
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
