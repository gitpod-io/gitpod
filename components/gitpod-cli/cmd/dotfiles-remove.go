// Copyright (c) Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var dotfilesRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove your linked dotfiles repository.",
	Long:  `Remove your linked dotfiles repository from your Gitpod account.`,
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		server, err := gitpod.GetServer(ctx)
		if err != nil {
			return xerrors.Errorf("could not connect to Gitpod server: %w", err)
		}

		// Set dotfiles repository to empty string to remove it
		err = server.SetDotfilesRepository(ctx, "")
		if err != nil {
			// TODO: Handle specific errors from the server
			return xerrors.Errorf("could not remove dotfiles repository: %w", err)
		}

		fmt.Println("Successfully removed dotfiles repository.")
		return nil
	},
}

func init() {
	dotfilesCmd.AddCommand(dotfilesRemoveCmd)
}
