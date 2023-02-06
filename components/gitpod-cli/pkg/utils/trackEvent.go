// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

const (
	Outcome_Success   = "success"
	Outcome_UserErr   = "user_error"
	Outcome_SystemErr = "system_error"
)

const (
	// System
	SystemErrorCode = "system_error"
	UserErrorCode   = "user_error"

	// Rebuild
	RebuildErrorCode_ImageBuildFailed    = "rebuild_image_build_failed"
	RebuildErrorCode_DockerErr           = "rebuild_docker_err"
	RebuildErrorCode_DockerNotFound      = "rebuild_docker_not_found"
	RebuildErrorCode_DockerRunFailed     = "rebuild_docker_run_failed"
	RebuildErrorCode_MalformedGitpodYaml = "rebuild_malformed_gitpod_yaml"
	RebuildErrorCode_MissingGitpodYaml   = "rebuild_missing_gitpod_yaml"
	RebuildErrorCode_NoCustomImage       = "rebuild_no_custom_image"
	RebuildErrorCode_AlreadyInDebug      = "rebuild_already_in_debug"
	RebuildErrorCode_InvaligLogLevel     = "rebuild_invalid_log_level"
)

type TrackCommandUsageParams struct {
	Command            string `json:"command,omitempty"`
	Duration           int64  `json:"duration,omitempty"`
	ErrorCode          string `json:"errorCode,omitempty"`
	WorkspaceId        string `json:"workspaceId,omitempty"`
	InstanceId         string `json:"instanceId,omitempty"`
	Timestamp          int64  `json:"timestamp,omitempty"`
	ImageBuildDuration int64  `json:"imageBuildDuration,omitempty"`
	Outcome            string `json:"outcome,omitempty"`
}

type AnalyticsEvent struct {
	Data             *TrackCommandUsageParams
	startTime        time.Time
	supervisorClient *supervisor.SupervisorClient
	ownerId          string
	w                analytics.Writer
}

func NewAnalyticsEvent(ctx context.Context, supervisorClient *supervisor.SupervisorClient, cmdParams *TrackCommandUsageParams) *AnalyticsEvent {
	event := &AnalyticsEvent{
		startTime:        time.Now(),
		supervisorClient: supervisorClient,
		w:                analytics.NewFromEnvironment(),
	}

	wsInfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		LogError(ctx, err, "Could not fetch the workspace info", supervisorClient)
		return nil
	}

	event.ownerId = wsInfo.OwnerId

	event.Data = &TrackCommandUsageParams{
		Command:     cmdParams.Command,
		Duration:    0,
		WorkspaceId: wsInfo.WorkspaceId,
		InstanceId:  wsInfo.InstanceId,
		ErrorCode:   "",
		Timestamp:   time.Now().UnixMilli(),
	}

	return event
}

func (e *AnalyticsEvent) Set(key string, value interface{}) *AnalyticsEvent {
	switch key {
	case "Command":
		e.Data.Command = value.(string)
	case "ErrorCode":
		e.Data.ErrorCode = value.(string)
	case "Duration":
		e.Data.Duration = value.(int64)
	case "WorkspaceId":
		e.Data.WorkspaceId = value.(string)
	case "InstanceId":
		e.Data.InstanceId = value.(string)
	case "ImageBuildDuration":
		e.Data.ImageBuildDuration = value.(int64)
	case "Outcome":
		e.Data.Outcome = value.(string)
	}
	return e
}

func (e *AnalyticsEvent) Send(ctx context.Context) {
	defer e.w.Close()

	e.Set("Duration", time.Since(e.startTime).Milliseconds())

	data := make(map[string]interface{})
	jsonData, err := json.Marshal(e.Data)
	if err != nil {
		LogError(ctx, err, "Could not marshal event data", e.supervisorClient)
		return
	}
	err = json.Unmarshal(jsonData, &data)
	if err != nil {
		LogError(ctx, err, "Could not unmarshal event data", e.supervisorClient)
		return
	}

	e.w.Track(analytics.TrackMessage{
		Identity:   analytics.Identity{UserID: e.ownerId},
		Event:      "gp_command",
		Properties: data,
	})
}
