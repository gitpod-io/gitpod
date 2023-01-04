// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import (
	"context"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
)

const (
	// System
	SystemErrorCode = "system_error"

	// Rebuild
	RebuildErrorCode_DockerBuildFailed     = "rebuild_docker_build_failed"
	RebuildErrorCode_DockerErr             = "rebuild_docker_err"
	RebuildErrorCode_DockerfileCannotRead  = "rebuild_dockerfile_cannot_read"
	RebuildErrorCode_DockerfileCannotWirte = "rebuild_dockerfile_cannot_write"
	RebuildErrorCode_DockerfileEmpty       = "rebuild_dockerfile_empty"
	RebuildErrorCode_DockerfileNotFound    = "rebuild_dockerfile_not_found"
	RebuildErrorCode_DockerNotFound        = "rebuild_docker_not_found"
	RebuildErrorCode_DockerRunFailed       = "rebuild_docker_run_failed"
	RebuildErrorCode_MalformedGitpodYaml   = "rebuild_malformed_gitpod_yaml"
	RebuildErrorCode_MissingGitpodYaml     = "rebuild_missing_gitpod_yaml"
	RebuildErrorCode_NoCustomImage         = "rebuild_no_custom_image"
)

type TrackCommandUsageParams struct {
	Command            string `json:"command,omitempty"`
	Duration           int64  `json:"duration,omitempty"`
	ErrorCode          string `json:"errorCode,omitempty"`
	WorkspaceId        string `json:"workspaceId,omitempty"`
	InstanceId         string `json:"instanceId,omitempty"`
	Timestamp          int64  `json:"timestamp,omitempty"`
	ImageBuildDuration int64  `json:"imageBuildDuration,omitempty"`
}

type EventTracker struct {
	Data             *TrackCommandUsageParams
	startTime        time.Time
	serverClient     *serverapi.APIoverJSONRPC
	supervisorClient *supervisor.SupervisorClient
}

func TrackEvent(ctx context.Context, supervisorClient *supervisor.SupervisorClient, cmdParams *TrackCommandUsageParams) *EventTracker {
	tracker := &EventTracker{
		startTime:        time.Now(),
		supervisorClient: supervisorClient,
	}

	wsInfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		LogError(ctx, err, "Could not fetch the workspace info", supervisorClient)
		return nil
	}

	serverClient, err := gitpod.ConnectToServer(ctx, wsInfo, []string{"function:trackEvent"})
	if err != nil {
		log.WithError(err).Fatal("error connecting to server")
		return nil
	}

	tracker.serverClient = serverClient

	tracker.Data = &TrackCommandUsageParams{
		Command:     cmdParams.Command,
		Duration:    0,
		WorkspaceId: wsInfo.WorkspaceId,
		InstanceId:  wsInfo.InstanceId,
		ErrorCode:   "",
		Timestamp:   time.Now().UnixMilli(),
	}

	return tracker
}

func (t *EventTracker) Set(key string, value interface{}) *EventTracker {
	switch key {
	case "Command":
		t.Data.Command = value.(string)
	case "ErrorCode":
		t.Data.ErrorCode = value.(string)
	case "Duration":
		t.Data.Duration = value.(int64)
	case "WorkspaceId":
		t.Data.WorkspaceId = value.(string)
	case "InstanceId":
		t.Data.InstanceId = value.(string)
	case "ImageBuildDuration":
		t.Data.ImageBuildDuration = value.(int64)
	}
	return t
}

func (t *EventTracker) Send(ctx context.Context) {
	t.Set("Duration", time.Since(t.startTime).Milliseconds())

	event := &serverapi.RemoteTrackMessage{
		Event:      "gp_command",
		Properties: t.Data,
	}

	err := t.serverClient.TrackEvent(ctx, event)
	if err != nil {
		LogError(ctx, err, "Could not track gp command event", t.supervisorClient)
		return
	}
}
