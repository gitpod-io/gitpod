// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package helper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
)

// OpenWorkspaceInPreferredEditor opens the workspace in the user's preferred editor
func OpenWorkspaceInPreferredEditor(ctx context.Context, clnt *client.Gitpod, workspaceID string) error {
	workspace, err := clnt.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
	if err != nil {
		return err
	}

	if workspace.Msg.Result.Status.Instance.Status.Phase != v1.WorkspaceInstanceStatus_PHASE_RUNNING {
		return fmt.Errorf("cannot open workspace, workspace is not running")
	}

	wsUrl, err := url.Parse(workspace.Msg.Result.Status.Instance.Status.Url)
	if err != nil {
		return err
	}

	wsHost := wsUrl.Host

	u := url.URL{
		Scheme: "https",
		Host:   wsHost,
		Path:   "_supervisor/v1/status/ide/wait/true",
	}

	resp, err := http.Get(u.String())
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var response struct {
		OK      bool `json:"ok"`
		Desktop struct {
			Link     string `json:"link"`
			Label    string `json:"label"`
			ClientID string `json:"clientID"`
			Kind     string `json:"kind"`
		} `json:"desktop"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return err
	}

	if response.OK {
		url := response.Desktop.Link
		if url == "" && HasInstanceStatus(workspace.Msg.Result) {
			url = workspace.Msg.Result.Status.Instance.Status.Url
		}
		var cmd *exec.Cmd
		switch os := runtime.GOOS; os {
		case "darwin":
			cmd = exec.Command("open", url)
		case "linux":
			cmd = exec.Command("xdg-open", url)
		case "windows":
			cmd = exec.Command("cmd", "/c", "start", url)
		default:
			panic("unsupported platform")
		}

		err := cmd.Start()
		if err != nil {
			if execErr, ok := err.(*exec.Error); ok && execErr.Err == exec.ErrNotFound {
				return fmt.Errorf("executable file not found in $PATH: %s. Please open %s manually instead", execErr.Name, url)
			}
			return fmt.Errorf("failed to open workspace in editor: %w", err)
		}
	} else {
		return fmt.Errorf("failed to open workspace in editor (workspace not ready yet)")
	}

	return nil
}

// SSHConnectToWorkspace connects to the workspace via SSH
func SSHConnectToWorkspace(ctx context.Context, clnt *client.Gitpod, workspaceID string, runDry bool) error {
	workspace, err := clnt.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
	if err != nil {
		return err
	}

	wsInfo := workspace.Msg.GetResult()

	if wsInfo.Status.Instance.Status.Phase != v1.WorkspaceInstanceStatus_PHASE_RUNNING {
		return fmt.Errorf("cannot connect, workspace is not running")
	}

	token, err := clnt.Workspaces.GetOwnerToken(ctx, connect.NewRequest(&v1.GetOwnerTokenRequest{WorkspaceId: workspaceID}))
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

	slog.Debug("Connecting to" + wsInfo.Description)
	command := exec.Command("ssh", fmt.Sprintf("%s#%s@%s", wsInfo.WorkspaceId, ownerToken, host), "-o", "StrictHostKeyChecking=no")

	command.Stdin = os.Stdin
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	if err := command.Run(); err != nil {
		return err
	}

	return nil
}

// HasInstanceStatus returns true if the workspace has an instance status
func HasInstanceStatus(ws *v1.Workspace) bool {
	if ws == nil || ws.Status == nil || ws.Status.Instance == nil || ws.Status.Instance.Status == nil {
		return false
	}

	return true
}

// ObserveWorkspaceUntilStarted waits for the workspace to start and prints the status
func ObserveWorkspaceUntilStarted(ctx context.Context, clnt *client.Gitpod, workspaceID string) error {
	wsInfo, err := clnt.Workspaces.GetWorkspace(ctx, connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: workspaceID}))
	if err != nil {
		return fmt.Errorf("cannot get workspace info: %w", err)
	}

	if wsInfo.Msg.GetResult().Status.Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING {
		// workspace is running - we're done
		return nil
	}

	slog.Info("waiting for workspace to start...", "workspaceID", workspaceID)
	if HasInstanceStatus(wsInfo.Msg.Result) {
		slog.Info("workspace " + prettyprint.FormatWorkspacePhase(wsInfo.Msg.Result.Status.Instance.Status.Phase))
	}

	var (
		maxRetries = 5
		retries    = 0
		delay      = 100 * time.Millisecond
	)
	for {
		stream, err := clnt.Workspaces.StreamWorkspaceStatus(ctx, connect.NewRequest(&v1.StreamWorkspaceStatusRequest{WorkspaceId: workspaceID}))
		if err != nil {
			if retries >= maxRetries {
				return prettyprint.AddApology(fmt.Errorf("failed to stream workspace status after %d retries: %w", maxRetries, err))
			}
			retries++
			delay *= 2
			slog.Warn("failed to stream workspace status, retrying", "err", err, "retry", retries, "maxRetries", maxRetries)
			continue
		}

		previousStatus := ""
		for stream.Receive() {
			msg := stream.Msg()
			if msg == nil {
				slog.Debug("no message received")
				continue
			}

			if msg.GetResult().Instance.Status.Phase == v1.WorkspaceInstanceStatus_PHASE_RUNNING {
				slog.Info("workspace running")
				return nil
			}

			var currentStatus string
			if HasInstanceStatus(wsInfo.Msg.Result) {
				currentStatus = prettyprint.FormatWorkspacePhase(wsInfo.Msg.Result.Status.Instance.Status.Phase)
			}
			if currentStatus != previousStatus {
				slog.Info("workspace " + currentStatus)
				previousStatus = currentStatus
			}
		}
		if err := stream.Err(); err != nil {
			if retries >= maxRetries {
				return prettyprint.AddApology(fmt.Errorf("failed to stream workspace status after %d retries: %w", maxRetries, err))
			}
			retries++
			delay *= 2
			slog.Warn("failed to stream workspace status, retrying", "err", err, "retry", retries, "maxRetries", maxRetries)
			continue
		}

		return prettyprint.AddApology(fmt.Errorf("workspace stream ended unexpectedly"))
	}
}
