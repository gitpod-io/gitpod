// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package runner

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	"github.com/gitpod-io/local-app/pkg/dockercli"
	"github.com/gitpod-io/local-app/pkg/dockercli/porcelain"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewLocalWorkspaceRunner(client v1connect.WorkspaceRunnerServiceClient, userID string) *LocalWorkspaceRunner {
	return &LocalWorkspaceRunner{
		Client: client,
		UserID: userID,
	}
}

type LocalWorkspaceRunner struct {
	Client v1connect.WorkspaceRunnerServiceClient
	Docker dockercli.CLI

	UserID   string
	runnerID string
}

func (runner *LocalWorkspaceRunner) Run(ctx context.Context) error {
	reg, err := runner.Client.RegisterRunner(ctx, &connect.Request[v1.RegisterRunnerRequest]{
		Msg: &v1.RegisterRunnerRequest{
			Scope: &v1.RegisterRunnerRequest_UserId{
				UserId: runner.UserID,
			},
		},
	})
	if err != nil {
		return err
	}
	runner.runnerID = reg.Msg.ClusterId
	slog.Info("registered runner", "runnerID", runner.runnerID)

	go renewRegistration(ctx, runner.Client, runner.runnerID)

	existing, err := getExistingWorkspaces(ctx, runner.Client, runner.runnerID)
	if err != nil {
		return err
	}
	notifications := receiveNotifications(ctx, runner.Client, runner.runnerID)
	for {
		var ws *v1.RunnerWorkspace
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ws = <-notifications:
		case ws = <-existing:
		}

		err := runner.reconcile(ctx, ws)
		if err != nil {
			slog.Error("cannot reconcile workspace", "err", err)
		}
	}
}

func (runner *LocalWorkspaceRunner) reconcile(ctx context.Context, ws *v1.RunnerWorkspace) (err error) {
	status, err := runner.getWorkspaceStatus(ctx, ws)

	slog.Debug("reconciling workspace", "workspaceID", ws.Id, "status", status)
	switch ws.DesiredPhase {
	case v1.WorkspacePhase_PHASE_STOPPED:
		// return runner.stopWorkspaceIfNotStopping(ctx, ws)
	case v1.WorkspacePhase_PHASE_RUNNING:
		if connect.CodeOf(err) == connect.CodeNotFound {
			return runner.startWorkspace(ctx, ws)
		}
	}
	return nil
}

func (runner *LocalWorkspaceRunner) getWorkspaceStatus(ctx context.Context, ws *v1.RunnerWorkspace) (status *v1.WorkspaceStatus, err error) {
	container, err := runner.Docker.ContainerList(porcelain.ContainerLsOpts{Filter: "label=gitpod-workspace-id=" + ws.Id})
	if err != nil {
		return nil, err
	}
	slog.Debug("getWorkspaceStatus", "out", container)
	if len(container) == 0 {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("workspace %s not found", ws.Id))
	}

	return &v1.WorkspaceStatus{
		StatusVersion: uint64(time.Now().UnixMicro()),
		Phase: &v1.WorkspacePhase{
			Name:               v1.WorkspacePhase_PHASE_RUNNING,
			LastTransitionTime: timestamppb.Now(),
		},
		WorkspaceUrl: "http://localhost:8080",
		Conditions:   &v1.WorkspaceStatus_WorkspaceConditions{},
	}, nil
}

func (runner *LocalWorkspaceRunner) startWorkspace(ctx context.Context, ws *v1.RunnerWorkspace) (err error) {
	return nil
}

func renewRegistration(ctx context.Context, client v1connect.WorkspaceRunnerServiceClient, runnerID string) {
	for {
		if ctx.Err() != nil {
			return
		}
		_, err := client.RenewRunnerRegistration(ctx, &connect.Request[v1.RenewRunnerRegistrationRequest]{
			Msg: &v1.RenewRunnerRegistrationRequest{
				ClusterId: runnerID,
			},
		})
		if err != nil {
			slog.Error("cannot renew runner registration", "err", err)
		}

		time.Sleep(10 * time.Second)
	}
}

func receiveNotifications(ctx context.Context, client v1connect.WorkspaceRunnerServiceClient, runnerID string) <-chan *v1.RunnerWorkspace {
	resp := make(chan *v1.RunnerWorkspace, 1)
	go func() {
		defer close(resp)
		for {
			if ctx.Err() != nil {
				return
			}
			notifications, err := client.WatchRunnerWorkspaces(ctx, &connect.Request[v1.WatchRunnerWorkspacesRequest]{
				Msg: &v1.WatchRunnerWorkspacesRequest{
					ClusterId: runnerID,
				},
			})
			if err != nil {
				// TODO(cw): add some sensible retry logic
				slog.Error("cannot watch runner workspaces", "err", err)
				return
			}

			for notifications.Receive() {
				if ctx.Err() != nil {
					return
				}
				resp <- notifications.Msg().Workspace
			}
			if notifications.Err() != nil {
				slog.Warn("cannot receive runner workspace notifications", "err", notifications.Err())
			}
		}
	}()
	return resp
}

func getExistingWorkspaces(ctx context.Context, client v1connect.WorkspaceRunnerServiceClient, runnerID string) (<-chan *v1.RunnerWorkspace, error) {
	resp, err := client.ListRunnerWorkspaces(ctx, &connect.Request[v1.ListRunnerWorkspacesRequest]{
		Msg: &v1.ListRunnerWorkspacesRequest{
			ClusterId: runnerID,
		},
	})
	if err != nil {
		return nil, err
	}

	result := make(chan *v1.RunnerWorkspace, 1)
	go func() {
		defer close(result)
		for _, ws := range resp.Msg.Workspaces {
			result <- ws
		}
	}()
	return result, nil
}
