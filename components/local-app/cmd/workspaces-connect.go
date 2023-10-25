// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/common"
	"github.com/spf13/cobra"
)

// connectWorkspaceCommand connects to a given workspace
var connectWorkspaceCommand = &cobra.Command{
	Use:   "ssh <workspace-id>",
	Short: "Connects to a workspace via SSH",
	RunE: func(cmd *cobra.Command, args []string) error {
		workspaceID := ""
		if len(args) < 1 {
			// Only select from workspaces that are currently running
			filter := func(ws *v1.Workspace) bool {
				return ws.GetStatus().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING
			}
			workspaceID = common.SelectWorkspace(cmd.Context(), filter)
		} else {
			workspaceID = args[0]
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		workspace, err := gitpod.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		wsInfo := workspace.Msg.GetResult()

		if wsInfo.Status.Instance.Status.Phase != v1.WorkspaceInstanceStatus_PHASE_RUNNING {
			return fmt.Errorf("cannot connect, workspace is not running")
		}

		token, err := gitpod.Workspaces.GetOwnerToken(ctx, connect.NewRequest(&v1.GetOwnerTokenRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}

		ownerToken := token.Msg.Token

		host := strings.Replace(wsInfo.Status.Instance.Status.Url, wsInfo.WorkspaceId, wsInfo.WorkspaceId+".ssh", -1)
		host = strings.Replace(host, "https://", "", -1)

		if dryRun, err := cmd.Flags().GetBool("dry-run"); err == nil && dryRun {
			fmt.Println("ssh", fmt.Sprintf("%s#%s@%s", wsInfo.WorkspaceId, ownerToken, host), "-o", "StrictHostKeyChecking=no")
			return nil
		}

		fmt.Println("Connecting to", wsInfo.Description)

		command := exec.Command("ssh", fmt.Sprintf("%s#%s@%s", wsInfo.WorkspaceId, ownerToken, host), "-o", "StrictHostKeyChecking=no")

		command.Stdin = os.Stdin
		command.Stdout = os.Stdout
		command.Stderr = os.Stderr

		if err := command.Run(); err != nil {
			os.Exit(1)
		}

		return nil
	},
}

func init() {
	wsCmd.AddCommand(connectWorkspaceCommand)
	connectWorkspaceCommand.Flags().BoolP("dry-run", "n", false, "Dry run the command")
}
