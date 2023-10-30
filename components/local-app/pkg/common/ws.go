// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

func SshConnectToWs(ctx context.Context, workspaceID string, runDry bool) error {
	gitpod, err := GetGitpodClient(ctx)
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

	if runDry {
		fmt.Println("ssh", fmt.Sprintf("%s#%s@%s", wsInfo.WorkspaceId, ownerToken, host), "-o", "StrictHostKeyChecking=no")
		return nil
	}

	slog.Debug("Connecting to", wsInfo.Description)

	command := exec.Command("ssh", fmt.Sprintf("%s#%s@%s", wsInfo.WorkspaceId, ownerToken, host), "-o", "StrictHostKeyChecking=no")

	command.Stdin = os.Stdin
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	if err := command.Run(); err != nil {
		return err
	}

	return nil
}
