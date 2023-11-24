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

var pinCmd = &cobra.Command{
	Use:   "pin",
	Short: "Toggle pinning of the current workspace",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithCancel(context.Background())
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-sigChan
			cancel()
		}()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:updateWorkspaceUserPin",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			return err
		}
		action := protocol.PinActionToggle
		err = client.UpdateWorkspaceUserPin(ctx, wsInfo.WorkspaceId, &action)
		if err != nil {
			return err
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(pinCmd)
}
