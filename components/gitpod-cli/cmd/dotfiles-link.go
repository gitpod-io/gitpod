// Copyright (c) Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var dotfilesLinkCmd = &cobra.Command{
	Use:   "link <repository-url>",
	Short: "Link your dotfiles repository.",
	Long:  `Link your dotfiles repository to your Gitpod account.`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		repositoryURL := args[0]

		// TODO: Validate repositoryURL format

		ctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		server, err := gitpod.GetServer(ctx)
		if err != nil {
			return xerrors.Errorf("could not connect to Gitpod server: %w", err)
		}

		err = server.SetDotfilesRepository(ctx, repositoryURL)
		if err != nil {
			// TODO: Handle specific errors from the server (e.g., invalid URL, repository not found)
			return xerrors.Errorf("could not link dotfiles repository: %w", err)
		}

		fmt.Printf("Successfully linked dotfiles repository: %s
", repositoryURL)
		utils.TrackCommandUsageEvent.SetAnnotation("repository_url", repositoryURL)

		return nil
	},
}

func init() {
	dotfilesCmd.AddCommand(dotfilesLinkCmd)
}
