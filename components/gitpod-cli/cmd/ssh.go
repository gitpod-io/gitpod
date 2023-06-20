// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/spf13/cobra"
)

var accessKey bool

// sshCmd commands collection
var sshCmd = &cobra.Command{
	Use:   "ssh",
	Short: "Show the SSH connection command for the current workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}

		host := strings.Replace(wsInfo.WorkspaceUrl, wsInfo.WorkspaceId, wsInfo.WorkspaceId+".ssh", -1)
		//sshAccessTokenHost := fmt.Sprintf(`ssh '%s#%s@%s'`, wsInfo.WorkspaceId, wsInfo.Own, host)
		sshAccessTokenHost := fmt.Sprintf(`%s#%s@%s`, wsInfo.WorkspaceId, "ownerToken", host)
		sshKeyHost := fmt.Sprintf(`%s@%s`, wsInfo.WorkspaceId, host)

		// ssh command depends on the flags
		sshHost := sshKeyHost
		if accessKey {
			// todo(ft): implement getting Owner Token
			sshHost = sshAccessTokenHost
		}

		sshCommand := fmt.Sprintf(`ssh '%s'`, sshHost)
		fmt.Println(sshCommand)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(sshCmd)
	sshCmd.Flags().BoolVar(&accessKey, "access-key", false, "Show the ssh access token command")
}
