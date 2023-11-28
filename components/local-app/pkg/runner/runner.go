// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/local-app/pkg/dockercli"
	"github.com/gitpod-io/local-app/pkg/dockercli/porcelain"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// MachineMetadata is the metadata we store on the firecracker metadata service
type MachineMetadata struct {
	WorkspaceShim        string                `json:"workspaceShim,omitempty"`
	WorkspaceType        WorkspaceType         `json:"workspaceType"`
	EnvironmentVariables []EnvironmentVariable `json:"envvars,omitempty"`
	Subassemblies        []SubassemblyMetadata `json:"subassemblies,omitempty"`
	ContentInitializer   []byte                `json:"contentInitializer,omitempty"`
	EventTrackerAddr     string                `json:"eventTrackerAddr,omitempty"`

	// Note(cw): we don't actually use those fields but need to retain them to
	//           be compatible with the firecracker metadata.
	DoNotUse00 string `json:"instance-id"`
	DoNotUse01 string `json:"local-hostname"`
}

// SubassemblyMetadata describes a Subassembly from within a uVM
type SubassemblyMetadata struct {
	Index            int                  `json:"index"`
	Name             string               `json:"name"`
	DriveID          string               `json:"driveID"`
	Manifest         SubassemblyManifest  `json:"manifest"`
	Readonly         bool                 `json:"readonly"`
	MountType        SubassemblyMountType `json:"mountType"`
	MachineMountPath string               `json:"machineMountPath"`
}

type WorkspaceType string

const (
	WorkspaceTypeRegular  WorkspaceType = "regular"
	WorkspaceTypePrebuild WorkspaceType = "prebuild"
)

type EnvironmentVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// SubassemblyManifest describes the requirements of a subassembly
type SubassemblyManifest struct {
	// Mounts describes how the subassembly is mounted
	Mounts []SubassemblyMount `json:"mounts,omitempty"`

	// PostStartCommand is a command that is executed after the subassembly is mounted and the uVM/shim has started,
	// but before the workspace is considered ready. If this command fails, the workspace is considered failed.
	// This command blocks the workspace start (because of the readiness check), so it should be kept short.
	PostStartCommand []string `json:"postStartCommand,omitempty"`
}

// SubassemblyMount describes how a subassembly is mounted
type SubassemblyMount struct {
	// Source describes a path from within the subassembly
	Source string
	// Target describes a path in target filesystem where source is mounted to
	Target string
}

type SubassemblyMountType string

const (
	// SubassemblyMountTypeShim is the default mount type, which uses a shim to mount the subassembly
	SubassemblyMountTypeShim SubassemblyMountType = "shim"

	// SubassemblyMountTypeNative mounts the subassembly natively in the uVM.
	// When this type is used, the subassembly manifest must not have more than one entry, and the source is ignored.
	SubassemblyMountTypeNative SubassemblyMountType = "native"
)

func NewLocalWorkspaceRunner(client v1connect.WorkspaceRunnerServiceClient, userID string) *LocalWorkspaceRunner {
	// porcelain.Verbose = true
	return &LocalWorkspaceRunner{
		Client:  client,
		Docker:  dockercli.Docker,
		UserID:  userID,
		WorkDir: filepath.Join(os.TempDir(), "gitpod", "local-runner"),
	}
}

type LocalWorkspaceRunner struct {
	Client v1connect.WorkspaceRunnerServiceClient
	Docker dockercli.CLI

	WorkDir  string
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
	go runner.observeDocker(ctx)

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

func (runner *LocalWorkspaceRunner) observeDocker(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	startImmediately := make(chan struct{}, 1)
	startImmediately <- struct{}{}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-startImmediately:
		}

		containers, err := runner.Docker.ContainerList(porcelain.ContainerLsOpts{
			All: true,
		})
		if err != nil {
			slog.Error("cannot list containers", "err", err)
			continue
		}

		for _, container := range containers {
			if !strings.Contains(container.Labels, "gitpod.io/workspaceID") {
				continue
			}

			slog.Debug("found workspace container", "workspaceID", container.ID)
			status, err := getWorkspaceStatusFromDocker(ctx, container.ID, runner.Docker.Inspect)
			if err != nil {
				slog.Error("cannot get workspace status", "err", err)
				continue
			}
			_, err = runner.Client.UpdateRunnerWorkspaceStatus(ctx, &connect.Request[v1.UpdateRunnerWorkspaceStatusRequest]{
				Msg: &v1.UpdateRunnerWorkspaceStatusRequest{
					ClusterId:   runner.runnerID,
					WorkspaceId: container.ID,
					Update: &v1.UpdateRunnerWorkspaceStatusRequest_Status{
						Status: status,
					},
				},
			})
			if err != nil {
				slog.Error("cannot update workspace status", "err", err)
				continue
			}
		}
	}
}

func (runner *LocalWorkspaceRunner) reconcile(ctx context.Context, ws *v1.RunnerWorkspace) (err error) {
	status, err := getWorkspaceStatusFromDocker(ctx, ws.Id, runner.Docker.Inspect)

	slog.Debug("reconciling workspace", "workspaceID", ws.Id, "status", status, "err", err, "desiredPhase", ws.DesiredPhase)
	switch ws.DesiredPhase {
	case v1.WorkspacePhase_PHASE_STOPPED:
		// return runner.stopWorkspaceIfNotStopping(ctx, ws)
	case v1.WorkspacePhase_PHASE_RUNNING:
		if connect.CodeOf(err) != connect.CodeNotFound {
			return nil
		}
		err := runner.startWorkspace(ctx, ws)
		if err != nil {
			status := &v1.WorkspaceStatus{
				StatusVersion: uint64(time.Now().UnixMicro()),
				Phase: &v1.WorkspacePhase{
					Name:               v1.WorkspacePhase_PHASE_STOPPED,
					LastTransitionTime: timestamppb.Now(),
				},
				Conditions: &v1.WorkspaceStatus_WorkspaceConditions{
					Failed:       err.Error(),
					FailedReason: v1.WorkspaceStatus_WorkspaceConditions_FAILED_REASON_IMAGE_PULL_FAILURE,
				},
			}
			_, err = runner.Client.UpdateRunnerWorkspaceStatus(ctx, &connect.Request[v1.UpdateRunnerWorkspaceStatusRequest]{
				Msg: &v1.UpdateRunnerWorkspaceStatusRequest{
					ClusterId:   runner.runnerID,
					WorkspaceId: ws.Id,
					Update: &v1.UpdateRunnerWorkspaceStatusRequest_Status{
						Status: status,
					},
				},
			})
			return err
		}

	}
	return nil
}

func getWorkspaceStatusFromDocker(ctx context.Context, id string, inspector func(ctx context.Context, id string) ([]dockercli.Inspect, error)) (status *v1.WorkspaceStatus, err error) {
	containers, err := inspector(ctx, id)
	if err != nil || len(containers) == 0 {
		if errors.Is(err, dockercli.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("workspace %s not found", id))
		}
		return nil, err
	}
	container := containers[0]

	var phase v1.WorkspacePhase_Phase
	switch {
	case container.State.Dead:
		phase = v1.WorkspacePhase_PHASE_STOPPED
	case container.State.Running:
		// TODO(cw): signal content init progress
		phase = v1.WorkspacePhase_PHASE_RUNNING
	}

	var conditions v1.WorkspaceStatus_WorkspaceConditions
	switch {
	case container.State.ExitCode != 0:
		conditions.Failed = container.State.Error
	}

	return &v1.WorkspaceStatus{
		StatusVersion: uint64(time.Now().UnixMicro()),
		Phase: &v1.WorkspacePhase{
			Name:               phase,
			LastTransitionTime: timestamppb.Now(),
		},
		WorkspaceUrl: "http://localhost:8080",
		Conditions:   &conditions,
	}, nil
}

func (runner *LocalWorkspaceRunner) startWorkspace(ctx context.Context, ws *v1.RunnerWorkspace) (err error) {
	var (
		wsdir      = filepath.Join(runner.WorkDir, ws.Id)
		contentDir = filepath.Join(wsdir, "content")
	)
	_ = os.MkdirAll(wsdir, 0755)
	slog.Info("starting workspace", "workspaceID", ws.Id, "wsdir", wsdir)

	var args []string
	args = append(args, "run", "-i", "--privileged", "--name", ws.Id)
	for _, vs := range []string{
		fmt.Sprintf("%s:/var/termination-log", filepath.Join(wsdir, "termination-log")),
		fmt.Sprintf("%s:/workspace", contentDir),
		"/var/run/docker.sock:/var/run/docker.sock",
	} {
		args = append(args, "-v", vs)
	}
	args = append(args, "-p", "22998:22998") // expose workspacekit API
	args = append(args, "--label", fmt.Sprintf("gitpod.io/workspaceID=%s", ws.Id))
	args = append(args, "--label", "gitpod.io/workspace=true")
	args = append(args, "localhost:5000/workspacekit-local-ng:commit-237578143bbd6f61bc18d4b89c643977a2037e77", "inside", "shim", "--docker-workspace-content-location", contentDir, "--mmds", "stdin")

	csapiInit, err := constructContentInit(ws.Spec.Initializer)
	if err != nil {
		return err
	}
	rawInit, err := protojson.Marshal(csapiInit)
	if err != nil {
		return err
	}
	contentInit, err := json.Marshal(struct {
		Req json.RawMessage `json:"req"`
	}{Req: rawInit})
	if err != nil {
		return err
	}

	md := MachineMetadata{
		WorkspaceShim:      "devcontainer",
		WorkspaceType:      WorkspaceTypeRegular,
		ContentInitializer: contentInit,
	}
	mdJSON, err := json.Marshal(md)
	if err != nil {
		return err
	}

	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = bytes.NewReader(append(mdJSON, '\n'))
	if err != nil {
		return err
	}
	err = cmd.Start()
	if err != nil {
		return err
	}
	slog.Debug("started container")

	return nil
}

func constructContentInit(init *v1.WorkspaceInitializer) (*csapi.WorkspaceInitializer, error) {
	if len(init.Specs) == 0 {
		return &csapi.WorkspaceInitializer{Spec: &csapi.WorkspaceInitializer_Empty{Empty: &csapi.EmptyInitializer{}}}, nil
	}

	switch spec := init.Specs[0].Spec.(type) {
	case *v1.WorkspaceInitializer_Spec_Git:
		var targetMode csapi.CloneTargetMode
		switch spec.Git.TargetMode {
		case v1.GitInitializer_CLONE_TARGET_MODE_REMOTE_BRANCH:
			targetMode = csapi.CloneTargetMode_REMOTE_BRANCH
		case v1.GitInitializer_CLONE_TARGET_MODE_REMOTE_COMMIT:
			targetMode = csapi.CloneTargetMode_REMOTE_COMMIT
		case v1.GitInitializer_CLONE_TARGET_MODE_REMOTE_HEAD:
			targetMode = csapi.CloneTargetMode_REMOTE_HEAD
		case v1.GitInitializer_CLONE_TARGET_MODE_LOCAL_BRANCH:
			targetMode = csapi.CloneTargetMode_LOCAL_BRANCH
		default:
			return nil, fmt.Errorf("cannot handle git target mode %v", spec.Git.TargetMode)
		}
		var gitConfig csapi.GitConfig
		if spec.Git.Config != nil {
			gitConfig = csapi.GitConfig{
				CustomConfig: spec.Git.Config.CustomConfig,
			}
			switch spec.Git.Config.Authentication {
			case v1.GitInitializer_AUTH_METHOD_BASIC_AUTH:
				gitConfig.Authentication = csapi.GitAuthMethod_BASIC_AUTH
			case v1.GitInitializer_AUTH_METHOD_BASIC_AUTH_OTS:
				gitConfig.Authentication = csapi.GitAuthMethod_BASIC_AUTH_OTS
			case v1.GitInitializer_AUTH_METHOD_UNSPECIFIED:
				gitConfig.Authentication = csapi.GitAuthMethod_NO_AUTH
			default:
				return nil, fmt.Errorf("cannot handle git authentication method %v", spec.Git.Config.Authentication)
			}
		}

		return &csapi.WorkspaceInitializer{Spec: &csapi.WorkspaceInitializer_Git{
			Git: &csapi.GitInitializer{
				RemoteUri:        spec.Git.RemoteUri,
				TargetMode:       targetMode,
				CloneTaget:       spec.Git.CloneTaget,
				CheckoutLocation: spec.Git.CheckoutLocation,
				Config:           &gitConfig,
			},
		}}, nil
	default:
		return nil, fmt.Errorf("cannot handle initializer spec %T", spec)
	}
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
			slog.Warn("cannot renew runner registration", "err", err)
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
			time.Sleep(5 * time.Second)
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
		for _, ws := range resp.Msg.Workspaces {
			result <- ws
		}
	}()
	return result, nil
}
