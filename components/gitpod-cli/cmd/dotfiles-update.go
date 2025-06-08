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

var dotfilesUpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Manually trigger an update of your dotfiles.",
	Long:  `Manually trigger an update of your dotfiles in your Gitpod workspace.`,
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 60*time.Second) // Longer timeout for update
		defer cancel()

		server, err := gitpod.GetServer(ctx)
		if err != nil {
			return xerrors.Errorf("could not connect to Gitpod server: %w", err)
		}

		err = server.UpdateDotfiles(ctx)
		if err != nil {
			// TODO: Handle specific errors from the server (e.g., no dotfiles linked)
			return xerrors.Errorf("could not update dotfiles: %w", err)
		}

		fmt.Println("Successfully triggered dotfiles update.")
		return nil
	},
}

func init() {
	dotfilesCmd.AddCommand(dotfilesUpdateCmd)
}
