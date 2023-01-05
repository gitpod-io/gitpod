// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/spf13/cobra"
)

// pinCmd represents the pinCmd command
var pinCmd = &cobra.Command{
	Use:   "pin",
	Short: "Toggle pinning of the current workspace",
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-sigChan
			cancel()
		}()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			fail(err.Error())
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:updateWorkspaceUserPin",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			fail(err.Error())
		}
		err = client.Pin(ctx, &protocol.PinOptions{
			WorkspaceID: wsInfo.WorkspaceId,
		})
		if err != nil {
			fail(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(pinCmd)
}
