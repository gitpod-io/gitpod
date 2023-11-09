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
	Args:  cobra.MinimumNArgs(1),
	Example: `  # connect to workspace with current terminal session
  $ gitpod workspace ssh <workspace-id>

  # Execute with ssh command
  $ gitpod workspace ssh <workspace-id> -- ls -la
  $ gitpod ws ssh <workspace-id> -- -t watch date

  # Get all SSH features with --dry-run
  $ $(gitpod workspace ssh <workspace-id> --dry-run) -- ls -la
  $ $(gitpod workspace ssh <workspace-id> --dry-run) -t watch date`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		workspaceID := args[0]

		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		dashDashIndex := cmd.ArgsLenAtDash()

		sshArgs := []string{}
		if dashDashIndex != -1 {
			sshArgs = args[dashDashIndex:]
		}

		return helper.SSHConnectToWorkspace(cmd.Context(), gitpod, workspaceID, dryRun, sshArgs...)
	},
}

func init() {
	workspaceCmd.AddCommand(workspaceSSHCmd)
	workspaceSSHCmd.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Dry run the command")
}
