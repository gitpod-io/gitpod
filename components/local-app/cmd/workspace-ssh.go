// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/spf13/cobra"
)

var dryRun bool

// workspaceSSHCmd connects to a given workspace
var workspaceSSHCmd = &cobra.Command{
	Use:   "ssh <workspace-id>",
	Short: "Connects to a workspace via SSH",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := args[0]

		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		return helper.SSHConnectToWorkspace(cmd.Context(), gitpod, workspaceID, dryRun)
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceSSHCmd)
	workspaceSSHCmd.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Dry run the command")
}
