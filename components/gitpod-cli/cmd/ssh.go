// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"

	"github.com/spf13/cobra"
)

var gitpodHost = os.Getenv("GITPOD_HOST")

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

		host := strings.Replace(wsInfo.WorkspaceUrl, wsInfo.WorkspaceId, wsInfo.WorkspaceId+".ssh", -1)
		sshKeyHost := fmt.Sprintf(`%s@%s`, wsInfo.WorkspaceId, host)

		sshHost := sshKeyHost
		sshCommand := fmt.Sprintf(`ssh '%s'`, sshHost)
		fmt.Println(sshCommand)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(sshCmd)
}
