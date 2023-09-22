// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"

	"github.com/spf13/cobra"
)

// todo(ft): distribute this common metadata from the root command to all subcommands to reduce latency
var gitpodHost = os.Getenv("GITPOD_HOST")

var sshCmdOpts struct {
	Local bool
	Remote bool
}

// sshCmd represents the ssh command
var sshCmd = &cobra.Command{
	Use:   "ssh",
	Short: "Show the SSH connection command for the current workspace",
	Long: fmt.Sprintf(`Displays a command with which you can connect to the current workspace.
The returned command requires SSH keys to be configured with Gitpod.
See %s/user/keys for a guide on setting them up.
`, gitpodHost), RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return fmt.Errorf("cannot get workspace info: %w", err)
		}

		var options := ""
		if sshCmdOpts.Local {
			options += "-L 3000:localhost:3000 "
		}
		if sshCmdOpts.Remote {
			options += "-N -R 5000:localhost:5000 "
		}

		sshCommand := fmt.Sprintf("ssh '%s@%s.ssh.%s' %s", wsInfo.WorkspaceId, wsInfo.WorkspaceId, wsInfo.WorkspaceClusterHost, options)
		fmt.Println(sshCommand)
		return nil
	},
}

func init() {
	sshCmd.Flags().BoolVarP(&sshCmdOpts.Local, "local", "", false, "Add options for local port forwarding")
	sshCmd.Flags().BoolVarP(&sshCmdOpts.Remote, "remote", "", false, "Add options for remote port forwarding")
	rootCmd.AddCommand(sshCmd)
}
