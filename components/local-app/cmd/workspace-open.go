// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log/slog"

	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/spf13/cobra"
)

// workspaceOpenCmd opens a given workspace in its pre-configured editor
var workspaceOpenCmd = &cobra.Command{
	Use:   "open <workspace-id>",
	Short: "Opens a given workspace in its pre-configured editor",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		workspaceID := args[0]

		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		slog.Debug("Attempting to open workspace...")
		return helper.OpenWorkspaceInPreferredEditor(cmd.Context(), gitpod, workspaceID)
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceOpenCmd)
}
